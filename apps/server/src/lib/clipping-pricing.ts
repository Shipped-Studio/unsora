/**
 * Pricing for AI clipping jobs.
 *
 * Rule: every started minute of source video costs `CLIPPING_CREDITS_PER_MINUTE`
 * credits. Minimum charge is one full minute.
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
