export const DEFAULT_CAPTION_STYLE = "temp-7";

export interface CaptionStyleOption {
  id: string;
  label: string;
}

export interface CaptionStyleGroup {
  label: string;
  styles: CaptionStyleOption[];
}

/**
 * Friendly labels named after how each Wayin template looks
 * (previews: public/caption-styles/<id>.webp).
 * Colors refer to the accent on the spoken word.
 */
const STYLE_LABELS: Record<string, string> = {
  "smart-bg-focus": "White Card",
  "box-highlight": "Black Box",
  "word-focus": "Bold White",
  "underline-focus": "White Underline",
  "temp-0": "Playful Green",
  "temp-1": "Sketch Blue",
  "temp-2": "Bubble Blue",
  "temp-3": "Bubble Green",
  "temp-4": "Glow Yellow",
  "temp-5": "Duo Green",
  "temp-6": "Duo Purple",
  "temp-7": "Classic Yellow",
  "temp-8": "Elegant Purple",
  "temp-9": "Neon Cyan",
  "temp-10": "Glow Pink",
  "temp-11": "Bold Yellow",
  "temp-12": "Soft Orange",
  "temp-13": "Glow Green",
  "temp-14": "Glow Orange",
  "temp-15": "Retro Outline",
  "temp-16": "Mint Bubble",
  "temp-17": "Comic Duo",
  "temp-static-1": "Static Outline",
  "temp-static-2": "Static Comic",
  "temp-static-3": "Static Minimal",
  "temp-static-4": "Static Green",
  "temp-static-5": "Static Yellow",
  "temp-static-6": "Static Orange",
  "game-streamer-1": "Gaming Magenta",
  "game-streamer-2": "Gaming Green",
  "game-streamer-3": "Gaming Yellow",
  "game-streamer-4": "Gaming White",
  "game-streamer-5": "Gaming Purple Box",
  "game-streamer-6": "Gaming Cyan",
  "game-streamer-7": "Gaming Orange Box",
};

const STYLE_IDS = [
  "smart-bg-focus",
  "box-highlight",
  "word-focus",
  "underline-focus",
  ...Array.from({ length: 18 }, (_, i) => `temp-${i}`),
  ...Array.from({ length: 6 }, (_, i) => `temp-static-${i + 1}`),
  ...Array.from({ length: 7 }, (_, i) => `game-streamer-${i + 1}`),
] as const;

export const WAYIN_CAPTION_STYLE_IDS: readonly string[] = STYLE_IDS;

function toOption(id: string): CaptionStyleOption {
  return { id, label: STYLE_LABELS[id] ?? id };
}

export const CAPTION_STYLE_GROUPS: CaptionStyleGroup[] = [
  {
    label: "Focus",
    styles: [
      "smart-bg-focus",
      "box-highlight",
      "word-focus",
      "underline-focus",
    ].map(toOption),
  },
  {
    label: "Animated",
    styles: Array.from({ length: 18 }, (_, i) => toOption(`temp-${i}`)),
  },
  {
    label: "Static",
    styles: Array.from({ length: 6 }, (_, i) =>
      toOption(`temp-static-${i + 1}`),
    ),
  },
  {
    label: "Game streamer",
    styles: Array.from({ length: 7 }, (_, i) =>
      toOption(`game-streamer-${i + 1}`),
    ),
  },
];

export function getCaptionStyleLabel(styleId: string) {
  return STYLE_LABELS[styleId] ?? styleId;
}

/**
 * Animated preview of a style ("Hey there"), white text on transparent, so
 * show it on a dark surface. Files live in public/caption-styles/.
 */
export function getCaptionStylePreview(styleId: string) {
  return `/caption-styles/${styleId}.webp`;
}
