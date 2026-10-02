/**
 * Pricing for video export / render jobs (client mirror).
 *
 * Must stay in sync with `server/src/lib/render-pricing.ts`. The server is the
 * source of truth — this file only exists so the export popover can show the
 * cost up-front before posting to `/api/exports`.
 */

export const RENDER_CREDITS_PER_MINUTE = 6;

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
