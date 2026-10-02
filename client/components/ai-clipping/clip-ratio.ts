/**
 * Clip ratio helpers. The API stores ratios either as "9:16" or "RATIO_9_16";
 * "original"/null means the source ratio (assume landscape).
 */
export function parseClipRatio(
  ratio?: string | null,
): { w: number; h: number } | null {
  if (!ratio) return null;
  const match =
    ratio.match(/^RATIO_(\d+)_(\d+)$/) ?? ratio.match(/^(\d+):(\d+)$/);
  if (!match) return null;
  return { w: Number(match[1]), h: Number(match[2]) };
}

export function clipAspectClass(ratio?: string | null): string {
  const parsed = parseClipRatio(ratio);
  if (!parsed) return "aspect-video";
  if (parsed.w === 9 && parsed.h === 16) return "aspect-[9/16]";
  if (parsed.w === parsed.h) return "aspect-square";
  if (parsed.w === 4 && parsed.h === 5) return "aspect-[4/5]";
  return "aspect-video";
}

/** Grid column classes tuned to the clip orientation. */
export function clipGridClass(ratio?: string | null): string {
  const parsed = parseClipRatio(ratio);
  if (parsed && parsed.h > parsed.w) {
    return "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5";
  }
  if (parsed && parsed.h === parsed.w) {
    return "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4";
  }
  return "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3";
}

/** Normalize a virality score to 0-100 whether the API sends 0-1 or 0-100. */
export function normalizeClipScore(score?: number | null): number | null {
  if (score == null || Number.isNaN(score)) return null;
  return Math.round(score <= 1 ? score * 100 : score);
}
