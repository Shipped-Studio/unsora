import { requireAuthOrApiKey } from "./auth";

/**
 * Clerk JWT or API key — enough to call public feature routes.
 *
 * Per-key rate limiting is now enforced by Unkey at verify time (see
 * `lib/unkey.ts`), so the old Redis-based `apiKeyRateLimit` middleware is no
 * longer in the chain.
 */
export const publicApiMiddleware = [...requireAuthOrApiKey];
