/**
 * Clip display helpers. The API stores ratios either as "9:16" or "RATIO_9_16";
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

/** ToolGrid shape that fits the clip orientation. */
export function clipGridShape(
  ratio?: string | null,
): "portrait" | "square" | "video" {
  const parsed = parseClipRatio(ratio);
  if (parsed && parsed.h > parsed.w) return "portrait";
  if (parsed && parsed.h === parsed.w) return "square";
  return "video";
}

/** "RATIO_9_16" or "9:16" as "9:16". */
export function formatClipRatio(ratio: string) {
  const parsed = parseClipRatio(ratio);
  return parsed ? `${parsed.w}:${parsed.h}` : ratio;
}

/** Normalize a virality score to 0-100 whether the API sends 0-1 or 0-100. */
export function normalizeClipScore(score?: number | null): number | null {
  if (score == null || Number.isNaN(score)) return null;
  return Math.round(score <= 1 ? score * 100 : score);
}

/** Seconds as m:ss, or null when unknown. */
export function formatClipTime(seconds?: number | null) {
  if (seconds == null || Number.isNaN(seconds)) return null;
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
