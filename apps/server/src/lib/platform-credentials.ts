import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { PlatformKey } from "./platforms";

/**
 * Social platform credentials (OAuth app ids, secrets, redirect URIs) edited
 * from /admin → Platforms, so an admin can rotate a key without touching
 * Railway or redeploying.
 *
 * Only the variables listed in PLATFORM_FIELDS can be set here. Everything
 * else (database, Clerk, Stripe, AI providers…) stays in environment
 * variables.
 *
 * How it works: values are stored AES-256-GCM encrypted in the app_settings
 * table, keyed by SETTINGS_ENCRYPTION_KEY (which lives only in the
 * environment). The API and the Trigger.dev worker copy the decrypted values
 * into process.env at boot and every SYNC_MS, so existing code that reads
 * process.env.X_CLIENT_ID keeps working unchanged. A value saved here wins
 * over the environment; removing it falls back to the environment again.
 *
 * Secrets are write-only: the admin API only ever returns their last four
 * characters.
 */

const SETTING_KEY = "platform.credentials";
const SYNC_MS = 30_000;

export interface PlatformField {
  name: string;
  label: string;
  /** Secrets are never shown back, only their last four characters. */
  secret: boolean;
}

const f = (name: string, label: string, secret = false): PlatformField => ({
  name,
  label,
  secret,
});

export const PLATFORM_FIELDS: Record<PlatformKey, PlatformField[]> = {
  google: [
    f("GOOGLE_CLIENT_ID", "OAuth client ID"),
    f("GOOGLE_CLIENT_SECRET", "OAuth client secret", true),
    f("GOOGLE_REDIRECT_URI", "Redirect URI"),
    f("YOUTUBE_API_KEY", "YouTube Data API key", true),
  ],
  tiktok: [
    f("TIKTOK_CLIENT_KEY", "Client key"),
    f("TIKTOK_CLIENT_SECRET", "Client secret", true),
    f("TIKTOK_REDIRECT", "Redirect URI"),
  ],
  instagram: [
    f("IG_APP_ID", "App ID"),
    f("IG_APP_SECRET", "App secret", true),
    f("IG_REDIRECT", "Redirect URI"),
  ],
  facebook: [
    f("FB_APP_ID", "App ID"),
    f("FB_APP_SECRET", "App secret", true),
    f("FB_REDIRECT", "Redirect URI"),
  ],
  threads: [
    f("THREADS_APP_ID", "App ID"),
    f("THREADS_APP_SECRET", "App secret", true),
    f("THREADS_REDIRECT", "Redirect URI"),
  ],
  bluesky: [
    f("BLUESKY_PRIVATE_KEY", "OAuth private key (ES256 JWK)", true),
    f("BLUESKY_REDIRECT", "Redirect URI"),
  ],
  pinterest: [
    f("PINTEREST_APP_ID", "App ID"),
    f("PINTEREST_APP_SECRET", "App secret", true),
    f("PINTEREST_REDIRECT", "Redirect URI"),
    f("PINTEREST_SANDBOX_TOKEN", "Sandbox token (test only)", true),
  ],
  linkedin: [
    f("LINKEDIN_APP_ID", "Client ID"),
    f("LINKEDIN_APP_SECRET", "Client secret", true),
    f("LINKEDIN_REDIRECT", "Redirect URI"),
  ],
  x: [
    f("X_CLIENT_ID", "OAuth 2.0 client ID"),
    f("X_CLIENT_SECRET", "OAuth 2.0 client secret", true),
    f("X_REDIRECT", "Redirect URI"),
  ],
  // Uses the YouTube Google OAuth client (GOOGLE_CLIENT_ID / SECRET).
  google_business: [f("GOOGLE_BUSINESS_REDIRECT", "Redirect URI")],
};

const FIELD_BY_NAME = new Map(
  Object.values(PLATFORM_FIELDS)
    .flat()
    .map((field) => [field.name, field]),
);

export function isPlatformFieldName(name: string): boolean {
  return FIELD_BY_NAME.has(name);
}

// ─── Encryption ────────────────────────────────────────────────────────────

interface StoredValue {
  /** base64 ciphertext */
  data: string;
  iv: string;
  tag: string;
  updatedAt: string;
  updatedBy?: string;
}

type Stored = Record<string, StoredValue>;

export class CredentialsKeyMissingError extends Error {
  constructor() {
    super(
      "SETTINGS_ENCRYPTION_KEY isn't set on the server, so credentials can't be saved here.",
    );
    this.name = "CredentialsKeyMissingError";
  }
}

function encryptionKey(): Buffer | null {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY?.trim();
  // Hash so any sufficiently random string works as the key.
  return raw ? createHash("sha256").update(raw).digest() : null;
}

function encrypt(value: string, key: Buffer): Omit<StoredValue, "updatedAt" | "updatedBy"> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    data: data.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

function decrypt(stored: StoredValue, key: Buffer): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(stored.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(stored.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(stored.data, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

async function readStored(): Promise<Stored> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
    const value = row?.value;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as unknown as Stored)
      : {};
  } catch (err) {
    console.warn("[platform-credentials] couldn't read stored credentials:", err);
    return {};
  }
}

// ─── process.env overlay ───────────────────────────────────────────────────

/** Environment values from before any admin override, to restore on removal. */
const original = new Map<string, string | undefined>();
/** Names currently overridden by a stored value. */
const overridden = new Set<string>();

/** Copy stored credentials into process.env (and undo removed ones). */
export async function applyPlatformCredentials(): Promise<void> {
  const stored = await readStored();
  const key = encryptionKey();
  const next = new Map<string, string>();

  if (key) {
    for (const [name, value] of Object.entries(stored)) {
      if (!isPlatformFieldName(name)) continue;
      try {
        next.set(name, decrypt(value, key));
      } catch {
        console.error(
          `[platform-credentials] couldn't decrypt ${name}; check SETTINGS_ENCRYPTION_KEY. Using the environment value.`,
        );
      }
    }
  } else if (Object.keys(stored).length) {
    console.warn(
      "[platform-credentials] credentials are stored but SETTINGS_ENCRYPTION_KEY is missing; using environment values.",
    );
  }

  for (const [name, value] of next) {
    if (!overridden.has(name)) original.set(name, process.env[name]);
    process.env[name] = value;
    overridden.add(name);
  }
  for (const name of [...overridden]) {
    if (next.has(name)) continue;
    const before = original.get(name);
    if (before === undefined) delete process.env[name];
    else process.env[name] = before;
    overridden.delete(name);
  }
}

let syncTimer: NodeJS.Timeout | null = null;

/** Apply now, then keep in sync. Safe to call more than once. */
export async function startPlatformCredentialSync(): Promise<void> {
  await applyPlatformCredentials();
  if (syncTimer) return;
  syncTimer = setInterval(() => {
    applyPlatformCredentials().catch((err) =>
      console.error("[platform-credentials] sync failed:", err),
    );
  }, SYNC_MS);
  syncTimer.unref();
}

// ─── Admin view + edits ────────────────────────────────────────────────────

export interface CredentialFieldView extends PlatformField {
  /** Where the live value comes from. */
  source: "admin" | "env" | "missing";
  /** Non-secrets: the value. Secrets: "••••" + last four characters. */
  display: string | null;
}

function mask(value: string): string {
  return value.length <= 4 ? "••••" : `••••${value.slice(-4)}`;
}

export async function credentialFieldsView(): Promise<
  Record<PlatformKey, CredentialFieldView[]>
> {
  const stored = await readStored();
  const view = {} as Record<PlatformKey, CredentialFieldView[]>;
  for (const [platform, fields] of Object.entries(PLATFORM_FIELDS)) {
    view[platform as PlatformKey] = fields.map((field) => {
      const fromAdmin = field.name in stored && overridden.has(field.name);
      const value = process.env[field.name]?.trim();
      return {
        ...field,
        source: fromAdmin ? "admin" : value ? "env" : "missing",
        display: value ? (field.secret ? mask(value) : value) : null,
      };
    });
  }
  return view;
}

export function credentialsKeyConfigured(): boolean {
  return encryptionKey() !== null;
}

/**
 * Save or remove admin-set credentials. A string stores the value; null
 * removes the admin value so the environment's applies again.
 */
export async function savePlatformCredentials(
  changes: Record<string, string | null>,
  updatedBy?: string,
): Promise<void> {
  const unknown = Object.keys(changes).filter((name) => !isPlatformFieldName(name));
  if (unknown.length) {
    throw new Error(`Not a platform credential: ${unknown.join(", ")}`);
  }

  const key = encryptionKey();
  const setsValue = Object.values(changes).some((v) => typeof v === "string");
  if (setsValue && !key) throw new CredentialsKeyMissingError();

  const stored = await readStored();
  const now = new Date().toISOString();
  for (const [name, value] of Object.entries(changes)) {
    const trimmed = typeof value === "string" ? value.trim() : null;
    if (!trimmed) {
      delete stored[name];
      continue;
    }
    stored[name] = { ...encrypt(trimmed, key!), updatedAt: now, updatedBy };
  }

  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: {
      key: SETTING_KEY,
      value: stored as unknown as Prisma.InputJsonObject,
      updatedBy,
    },
    update: { value: stored as unknown as Prisma.InputJsonObject, updatedBy },
  });

  // This process sees it immediately; others within SYNC_MS.
  await applyPlatformCredentials();
}
