/**
 * Credits charged per thumbnail output (keep in sync with client/lib/thumb-maker-config.ts).
 * Priced by analogy as 3 × a GPT Image 2 image @ 2k (4 credits each), since each
 * variation fans out into three generations.
 */
export const THUMB_CREDIT_PER_OUTPUT = 12;
export const THUMB_MAX_VARIATIONS = 20;
export const THUMB_MAX_TEMPLATES = 1;
export const THUMB_RATIO = "16:9";
export const THUMB_RESOLUTION = "2k";

export const THUMB_EXPRESSIONS = [
  "auto",
  "neutral",
  "soft-smile",
  "big-smile",
  "surprised",
  "confused",
  "worried",
  "angry",
  "sad",
  "disgusted",
  "determined",
] as const;

export type ThumbExpression = (typeof THUMB_EXPRESSIONS)[number];

/** Default channel context for thumbnail prompt ideation. */
export const THUMB_DEFAULT_PROJECT_CONTEXT = {
  description: "",
  highlights: [] as string[],
  targetAudience: "YouTube viewers",
};
