import type { Request } from "express";

/**
 * Accepts:
 * - Authorization: Bearer uns_live_...
 * - apiKey: uns_live_...          (Cursor mcp.json headers.apiKey)
 * - x-api-key: uns_live_...
 */
export function isUnsoraApiKey(value: string): boolean {
  return value.startsWith("uns_live_") || value.startsWith("uns_test_");
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
