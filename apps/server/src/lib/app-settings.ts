import { Prisma } from "@prisma/client";
import { prisma } from "./db";

/**
 * Runtime settings stored in the `app_settings` table, edited from /admin.
 * Reads are cached briefly per process, so every request doesn't hit the
 * database; an admin change shows up everywhere within CACHE_MS.
 *
 * Never store secrets here — credentials stay in environment variables.
 */

const CACHE_MS = 30_000;

const cache = new Map<string, { at: number; value: unknown }>();

/**
 * A setting's value, or `undefined` when it was never saved. A missing table
 * (migration not applied yet) also reads as `undefined`, so callers fall back
 * to their defaults instead of failing.
 */
export async function getSetting<T>(key: string): Promise<T | undefined> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T | undefined;

  let value: unknown;
  try {
    const row = await prisma.appSetting.findUnique({ where: { key } });
    value = row?.value ?? undefined;
  } catch (err) {
    console.warn(`[app-settings] couldn't read "${key}", using defaults:`, err);
    value = undefined;
  }
  cache.set(key, { at: Date.now(), value });
  return value as T | undefined;
}

export async function setSetting(
  key: string,
  value: Prisma.InputJsonValue,
  updatedBy?: string,
): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value, updatedBy },
    update: { value, updatedBy },
  });
  cache.set(key, { at: Date.now(), value });
}
