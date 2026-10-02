/**
 * Pricing for AI clipping jobs (client mirror).
 *
 * Must stay in sync with `server/src/lib/clipping-pricing.ts`. Display only —
 * the server calculates and deducts credits on `/api/clippings/create`.
 */

export const CLIPPING_CREDITS_PER_MINUTE = 4;

export function calculateClippingCredits(durationSeconds: number): number {
  if (
    typeof durationSeconds !== "number" ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return 0;
  }

  const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
  return minutes * CLIPPING_CREDITS_PER_MINUTE;
}
