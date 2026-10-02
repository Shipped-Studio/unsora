import crypto from "crypto";
import prisma from "./db";

export const API_KEY_PREFIX_LIVE = "uns_live_";
export const API_KEY_PREFIX_TEST = "uns_test_";
export const MAX_API_KEYS_PER_USER = 10;

/**
 * True for any Unsora API key — both Unkey-issued keys (`uns_*`) and legacy
 * keys (`uns_live_*` / `uns_test_*`) issued before the Unkey migration.
 * Clerk session/OAuth tokens never start with `uns_`, so this safely
 * distinguishes API keys from JWTs.
 */
export function isApiKeyToken(token: string): boolean {
  return token.startsWith("uns_");
}

/** True only for legacy DB-backed keys that predate the Unkey migration. */
export function isLegacyApiKeyToken(token: string): boolean {
  return (
    token.startsWith(API_KEY_PREFIX_LIVE) ||
    token.startsWith(API_KEY_PREFIX_TEST)
  );
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): {
  key: string;
  prefix: string;
  hash: string;
} {
  const secret = crypto.randomBytes(24).toString("base64url");
  const key = `${API_KEY_PREFIX_LIVE}${secret}`;
  const prefix = key.slice(0, 16);
  return { key, prefix, hash: hashApiKey(key) };
}

/**
 * Unkey holds the key secret, but attribution FKs
 * (`credit_transactions.apiKeyId`, `api_idempotency_records.apiKeyId`) point
 * at the local `api_keys` table — so every Unkey key needs a shadow metadata
 * row here (id = Unkey keyId, sentinel instead of a real hash). Idempotent.
 */
export async function mirrorUnkeyKey(opts: {
  keyId: string;
  userId: string;
  name?: string | null;
  keyPrefix?: string | null;
}): Promise<void> {
  await prisma.apiKey.upsert({
    where: { id: opts.keyId },
    update: {},
    create: {
      id: opts.keyId,
      userId: opts.userId,
      name: opts.name ?? "Unkey-managed key",
      keyPrefix: opts.keyPrefix ?? "uns_",
      keyHash: `unkey:${opts.keyId}`,
    },
  });
}

export async function validateApiKey(token: string): Promise<{
  apiKeyId: string;
  clerkId: string;
} | null> {
  const keyHash = hashApiKey(token);

  const apiKey = await prisma.apiKey.findFirst({
    where: {
      keyHash,
      revokedAt: null,
    },
    select: {
      id: true,
      user: {
        select: { clerkId: true },
      },
    },
  });

  if (!apiKey) return null;

  void prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return { apiKeyId: apiKey.id, clerkId: apiKey.user.clerkId };
}
