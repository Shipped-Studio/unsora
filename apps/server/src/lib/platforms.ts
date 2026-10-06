import type { NextFunction, Request, Response } from "express";
import { getSetting, setSetting } from "./app-settings";

/**
 * Which social platforms are live on this deployment.
 *
 * A platform is available when both hold:
 *  - its OAuth credentials are configured here (Bluesky needs none), and
 *  - it's switched on. The switch comes from, in order:
 *      1. /admin → Platforms (the `platforms.enabled` app setting),
 *      2. the ENABLED_PLATFORMS env var (comma-separated provider keys),
 *      3. otherwise every configured platform is on.
 *
 * Admins launch a platform from /admin once its API access is approved;
 * changes apply within ~30 seconds, with no redeploy.
 */

export const PLATFORMS_SETTING_KEY = "platforms.enabled";

export const PLATFORM_KEYS = [
  "google",
  "tiktok",
  "instagram",
  "facebook",
  "threads",
  "bluesky",
  "pinterest",
  "linkedin",
  "x",
  "google_business",
] as const;

export type PlatformKey = (typeof PLATFORM_KEYS)[number];

/** Env vars a platform's OAuth flow needs. */
const REQUIRED_ENV: Record<PlatformKey, string[]> = {
  google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  tiktok: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
  instagram: ["IG_APP_ID", "IG_APP_SECRET"],
  facebook: ["FB_APP_ID", "FB_APP_SECRET"],
  threads: ["THREADS_APP_ID", "THREADS_APP_SECRET"],
  bluesky: [],
  pinterest: ["PINTEREST_APP_ID", "PINTEREST_APP_SECRET"],
  linkedin: ["LINKEDIN_APP_ID", "LINKEDIN_APP_SECRET"],
  x: ["X_CLIENT_ID", "X_CLIENT_SECRET", "X_REDIRECT"],
  google_business: [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_BUSINESS_REDIRECT",
  ],
};

const NAMES: Record<PlatformKey, string> = {
  google: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  threads: "Threads",
  bluesky: "Bluesky",
  pinterest: "Pinterest",
  linkedin: "LinkedIn",
  x: "X",
  google_business: "Google Business Profile",
};

function isPlatformKey(value: string): value is PlatformKey {
  return (PLATFORM_KEYS as readonly string[]).includes(value);
}

function envList(): PlatformKey[] | null {
  const raw = process.env.ENABLED_PLATFORMS?.trim();
  if (!raw) return null;
  return raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(isPlatformKey);
}

/** Where the on/off switches currently come from. */
export type SwitchSource = "admin" | "env" | "default";

/** The switched-on platforms, ignoring credentials. */
async function switchedOn(): Promise<{ on: Set<PlatformKey>; source: SwitchSource }> {
  const saved = await getSetting<unknown>(PLATFORMS_SETTING_KEY);
  if (Array.isArray(saved)) {
    return {
      on: new Set(saved.filter((p): p is PlatformKey => typeof p === "string" && isPlatformKey(p))),
      source: "admin",
    };
  }
  const env = envList();
  if (env) return { on: new Set(env), source: "env" };
  return { on: new Set(PLATFORM_KEYS), source: "default" };
}

/** Env vars a platform still needs before it can work here. */
export function missingCredentials(platform: PlatformKey): string[] {
  return REQUIRED_ENV[platform].filter((name) => !process.env[name]?.trim());
}

export async function isPlatformEnabled(platform: string): Promise<boolean> {
  const key = platform.toLowerCase();
  if (!isPlatformKey(key)) return false;
  const { on } = await switchedOn();
  return on.has(key) && missingCredentials(key).length === 0;
}

export async function platformAvailability(): Promise<
  { id: PlatformKey; enabled: boolean }[]
> {
  const { on } = await switchedOn();
  return PLATFORM_KEYS.map((id) => ({
    id,
    enabled: on.has(id) && missingCredentials(id).length === 0,
  }));
}

/** Full picture for /admin: switch state, credentials, and the result. */
export async function platformAdminView() {
  const { on, source } = await switchedOn();
  return {
    source,
    platforms: PLATFORM_KEYS.map((id) => {
      const missing = missingCredentials(id);
      return {
        id,
        name: NAMES[id],
        switchedOn: on.has(id),
        missingCredentials: missing,
        live: on.has(id) && missing.length === 0,
      };
    }),
  };
}

/** Save the switched-on platforms from /admin. Unknown keys are dropped. */
export async function savePlatformSwitches(
  enabled: string[],
  updatedBy?: string,
): Promise<void> {
  const keys = [...new Set(enabled.map((p) => p.toLowerCase()))].filter(isPlatformKey);
  await setSetting(PLATFORMS_SETTING_KEY, keys, updatedBy);
}

/** Route guard for a platform's connect endpoints. */
export function requirePlatform(platform: PlatformKey) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    if (await isPlatformEnabled(platform)) return next();
    return res.status(403).json({
      success: false,
      error: `${NAMES[platform]} isn't available yet.`,
      code: "PLATFORM_UNAVAILABLE",
    });
  };
}

/** Names of the given platforms that aren't live here, for error messages. */
export async function unavailablePlatforms(providers: string[]): Promise<string[]> {
  const unique = [...new Set(providers)].filter(Boolean);
  const live = await Promise.all(unique.map((p) => isPlatformEnabled(p)));
  return unique
    .filter((_, i) => !live[i])
    .map((p) => NAMES[p as PlatformKey] ?? p);
}
