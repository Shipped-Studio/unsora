import { Unkey } from "@unkey/api";

/**
 * Unkey-backed API key management for the public `/api/v1` surface.
 *
 * Unkey is the source of truth for the key secret, ownership, and rate limit.
 * We link each key to a user via `externalId = clerkId`, so verifying a key
 * hands us back the owning user with no local DB lookup.
 */

const rootKey = process.env.UNKEY_ROOT_KEY;
export const UNKEY_API_ID = process.env.UNKEY_API_ID ?? "";

if (!rootKey || !UNKEY_API_ID) {
  console.warn(
    "[unkey] UNKEY_ROOT_KEY / UNKEY_API_ID not set — Unkey API key management is disabled.",
  );
}

export const unkey = new Unkey({ rootKey: rootKey ?? "" });

/** Keys are issued with this prefix so they're distinguishable from Clerk JWTs. */
export const API_KEY_PREFIX = "uns";
/** Per-key rate limit, enforced automatically by Unkey on every verify. */
export const API_KEY_RATE_LIMIT = 60;
const API_KEY_RATE_WINDOW_MS = 60_000;

export function isUnkeyConfigured(): boolean {
  return Boolean(rootKey && UNKEY_API_ID);
}

export async function createUnkeyKey(params: {
  clerkId: string;
  name: string;
}): Promise<{ key: string; keyId: string }> {
  const res = await unkey.keys.createKey({
    apiId: UNKEY_API_ID,
    prefix: API_KEY_PREFIX,
    name: params.name,
    externalId: params.clerkId,
    ratelimits: [
      {
        name: "requests",
        limit: API_KEY_RATE_LIMIT,
        duration: API_KEY_RATE_WINDOW_MS,
        autoApply: true,
      },
    ],
  });
  return { key: res.data.key, keyId: res.data.keyId };
}

export type VerifyResult =
  | { ok: true; clerkId: string; keyId: string }
  | { ok: false; rateLimited: boolean };

export async function verifyUnkeyKey(key: string): Promise<VerifyResult> {
  const res = await unkey.keys.verifyKey({ key });
  const data = res.data;
  if (data.valid && data.identity?.externalId) {
    return {
      ok: true,
      clerkId: data.identity.externalId,
      keyId: data.keyId ?? "",
    };
  }
  return { ok: false, rateLimited: data.code === "RATE_LIMITED" };
}

export async function listUnkeyKeys(clerkId: string) {
  const page = await unkey.apis.listKeys({
    apiId: UNKEY_API_ID,
    externalId: clerkId,
  });
  return page.result.data;
}

export async function revokeUnkeyKey(keyId: string): Promise<void> {
  await unkey.keys.deleteKey({ keyId });
}
