export const DEFAULT_CAPTION_STYLE = "temp-7";

export const WAYIN_CAPTION_STYLE_IDS = [
  "smart-bg-focus",
  "box-highlight",
  "word-focus",
  "underline-focus",
  ...Array.from({ length: 18 }, (_, i) => `temp-${i}`),
  ...Array.from({ length: 6 }, (_, i) => `temp-static-${i + 1}`),
  ...Array.from({ length: 7 }, (_, i) => `game-streamer-${i + 1}`),
] as const;

/**
 * Human-friendly preset names mapped to Wayin cc_style_tpl IDs, named after
 * how each style looks (previews: https://wayin.ai/api-docs/subtitles-style/).
 */
export const CAPTION_STYLE_PRESETS: Record<string, string> = {
  "classic-yellow": "temp-7",
  "white-card": "smart-bg-focus",
  "black-box": "box-highlight",
  "bold-white": "word-focus",
  "white-underline": "underline-focus",
  "playful-green": "temp-0",
  "sketch-blue": "temp-1",
  "bubble-blue": "temp-2",
  "bubble-green": "temp-3",
  "glow-yellow": "temp-4",
  "duo-green": "temp-5",
  "duo-purple": "temp-6",
  "elegant-purple": "temp-8",
  "neon-cyan": "temp-9",
  "glow-pink": "temp-10",
  "bold-yellow": "temp-11",
  "soft-orange": "temp-12",
  "glow-green": "temp-13",
  "glow-orange": "temp-14",
  "retro-outline": "temp-15",
  "mint-bubble": "temp-16",
  "comic-duo": "temp-17",
  "static-outline": "temp-static-1",
  "static-comic": "temp-static-2",
  "static-minimal": "temp-static-3",
  "static-green": "temp-static-4",
  "static-yellow": "temp-static-5",
  "static-orange": "temp-static-6",
  "gaming-magenta": "game-streamer-1",
  "gaming-green": "game-streamer-2",
  "gaming-yellow": "game-streamer-3",
  "gaming-white": "game-streamer-4",
  "gaming-purple-box": "game-streamer-5",
  "gaming-cyan": "game-streamer-6",
  "gaming-orange-box": "game-streamer-7",
};

export const CAPTION_STYLE_PRESET_NAMES = Object.keys(CAPTION_STYLE_PRESETS);

export function resolveCaptionSettings(input: {
  enableCaption?: unknown;
  captionStyle?: unknown;
}): {
  enableCaption: boolean;
  captionStyle: string | null;
  error?: string;
} {
  const enableCaption = input.enableCaption === true;

  if (!enableCaption) {
    return { enableCaption: false, captionStyle: null };
  }

  const raw =
    typeof input.captionStyle === "string" && input.captionStyle.trim()
      ? input.captionStyle.trim()
      : DEFAULT_CAPTION_STYLE;

  const style = CAPTION_STYLE_PRESETS[raw] ?? raw;

  if (!(WAYIN_CAPTION_STYLE_IDS as readonly string[]).includes(style)) {
    return {
      enableCaption: false,
      captionStyle: null,
      error: `Invalid captionStyle. Use one of: ${CAPTION_STYLE_PRESET_NAMES.join(", ")}`,
    };
  }

  return { enableCaption: true, captionStyle: style };
}
