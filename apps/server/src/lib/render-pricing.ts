/**
 * Pricing for video export / render jobs.
 *
 * Rule: every started minute of rendered video costs `RENDER_CREDITS_PER_MINUTE`
 * credits. A 30s clip costs the same as a 59s clip; 61s rolls over into the
 * next minute bucket. Mirrored on the client at `client/lib/render-pricing.ts`
 * so the popover can show the cost before the request is sent — keep both
 * formulas in sync.
 */

export const RENDER_CREDITS_PER_MINUTE = 6;

/**
 * Returns the credit cost for a render of the given duration (in seconds).
 *
 * - Returns `0` for non-positive / non-finite durations so callers can refuse
 *   the export early instead of silently charging the user.
 * - Otherwise rounds the duration up to the next whole minute and multiplies
 *   by `RENDER_CREDITS_PER_MINUTE`. Minimum charge is one full minute.
 */
export function calculateRenderCredits(durationSeconds: number): number {
  if (
    typeof durationSeconds !== "number" ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return 0;
  }

  const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
  return minutes * RENDER_CREDITS_PER_MINUTE;
}
