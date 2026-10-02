import type { Request } from "express";

/**
 * Accepts:
 * - Authorization: Bearer uns_...
 * - apiKey: uns_...          (Cursor mcp.json headers.apiKey)
 * - x-api-key: uns_...
 *
 * Current keys come from Unkey as `uns_<random>`; legacy keys are
 * `uns_live_...` / `uns_test_...`. Clerk OAuth tokens never use this prefix.
 */
export function isUnsoraApiKey(value: string): boolean {
  return value.startsWith("uns_");
}

/** Returns Unsora API key when present; null when request should use OAuth instead. */
export function tryGetApiKeyFromRequest(req: Request): string | null {
  const apiKeyHeader = req.header("apikey")?.trim();
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  const xApiKey = req.header("x-api-key")?.trim();
  if (xApiKey) {
    return xApiKey;
  }

  const authHeader = req.header("authorization");
  if (authHeader) {
    const bearer = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = bearer?.[1]?.trim();
    if (token && isUnsoraApiKey(token)) {
      return token;
    }

    const raw = authHeader.trim();
    if (raw && !raw.includes(" ") && isUnsoraApiKey(raw)) {
      return raw;
    }
  }

  return null;
}

export function getApiKeyFromRequest(req: Request): string {
  const apiKey = tryGetApiKeyFromRequest(req);
  if (apiKey) {
    return apiKey;
  }

  throw new Error(
    "Missing API key. Send apiKey header, x-api-key, or Authorization: Bearer <key>",
  );
}
