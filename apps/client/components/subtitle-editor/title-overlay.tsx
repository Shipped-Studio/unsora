// Kept identical in apps/client/components/subtitle-editor/title-overlay.tsx
// and apps/remotion/src/title-overlay.tsx, so the editor preview and the
// export draw the hook title the same way. Change both together.

import type { CSSProperties } from "react";

export interface TitleStyle {
  fontFamily: string;
  fontWeight: number;
  /** Font for words marked *like this* in the title text. */
  accentFontFamily: string;
  accentFontWeight: number;
  /** Accent words' size relative to the rest; script fonts run small. */
  accentScale?: number;
  textTransform: "none" | "uppercase";
  color: string;
  accentColor: string;
  /** Outline width in em. */
  strokeWidth?: number;
  strokeColor?: string;
  shadow?: string;
  /** Box drawn behind each line. */
  backgroundColor?: string;
  /** Fully rounded line boxes instead of slightly rounded ones. */
  pill?: boolean;
  /** Box drawn behind each accent word. */
  accentBackgroundColor?: string;
}

export interface TitleOverlayConfig {
  enabled: boolean;
  /** Lines split by "\n". Words wrapped in *asterisks* use the accent style. */
  text: string;
  /** Theme the style started from; "" for titles made before themes. */
  themeId: string;
  style: TitleStyle;
  /** Font size as a percentage of the frame width. */
  size: number;
  /** Centre of the title, as percentages of the frame. */
  positionX: number;
  positionY: number;
  /** Maximum width, as a percentage of the frame width. */
  width: number;
  /** Seconds the title stays on screen; ignored when fullVideo is on. */
  duration: number;
  fullVideo: boolean;
  animation: boolean;
  /** Earlier AI hooks, newest first. */
  history: string[];
}

export const DEFAULT_TITLE_STYLE: TitleStyle = {
  fontFamily: "poppins",
  fontWeight: 800,
  accentFontFamily: "dancing-script",
  accentFontWeight: 700,
  accentScale: 1.3,
  textTransform: "none",
  color: "#ffffff",
  accentColor: "#f97316",
  shadow: "0 0.04em 0.18em rgba(0,0,0,0.55)",
};

export const TITLE_OVERLAY_DEFAULTS: TitleOverlayConfig = {
  enabled: true,
  text: "",
  themeId: "nova",
  style: DEFAULT_TITLE_STYLE,
  size: 7,
  positionX: 50,
  positionY: 20,
  width: 90,
  duration: 3,
  fullVideo: false,
  animation: true,
  history: [],
};

/** How titles were stored before themes: Inter, px size, offsets. */
interface LegacyTitleOverlay {
  enabled?: boolean;
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  xAxis?: number;
  yAxis?: number;
  width?: number;
}

/**
 * Fills in missing fields and converts titles saved in the old format so
 * they keep their look: same size and place, shown for the whole video.
 */
export function normalizeTitleOverlay(
  raw: unknown,
  frame: { width: number; height: number },
): TitleOverlayConfig {
  const stored = (raw ?? {}) as Partial<TitleOverlayConfig> &
    LegacyTitleOverlay;

  if (stored.style && typeof stored.size === "number") {
    return {
      ...TITLE_OVERLAY_DEFAULTS,
      ...stored,
      style: { ...DEFAULT_TITLE_STYLE, ...stored.style },
      history: Array.isArray(stored.history) ? stored.history : [],
    };
  }

  const color = stored.color ?? "#ffffff";
  const fontSize = stored.fontSize ?? 48;
  return {
    ...TITLE_OVERLAY_DEFAULTS,
    enabled: stored.enabled ?? TITLE_OVERLAY_DEFAULTS.enabled,
    text: stored.text ?? "",
    themeId: "",
    style: {
      fontFamily: "inter",
      fontWeight: stored.fontWeight ?? 700,
      accentFontFamily: "inter",
      accentFontWeight: stored.fontWeight ?? 700,
      textTransform: "none",
      color,
      accentColor: color,
      shadow: "0 0.04em 0.17em rgba(0,0,0,0.5)",
    },
    size: Math.round((fontSize / frame.width) * 200) / 2,
    positionX: 50 + (stored.xAxis ?? 0),
    // The old value placed the top of a one-line title; this is its centre.
    positionY:
      Math.round((8 + (stored.yAxis ?? 0) + (fontSize * 60) / frame.height) * 2) /
      2,
    width: stored.width ?? 90,
    fullVideo: true,
    animation: false,
  };
}

export interface TitleWord {
  text: string;
  accent: boolean;
}

/** Lines of words; `*a b*` marks both words as accent. */
export function parseTitle(text: string): TitleWord[][] {
  return text
    .split("\n")
    .map((line) => {
      const words: TitleWord[] = [];
      for (const match of line.matchAll(/\*([^*]+)\*|([^*]+)/g)) {
        const accent = match[1] !== undefined;
        for (const word of (match[1] ?? match[2]).split(/\s+/)) {
          if (word) words.push({ text: word, accent });
        }
      }
      return words;
    })
    .filter((line) => line.length > 0);
}

/** Whether the title is on screen at `time` seconds into the video. */
export function isTitleVisible(config: TitleOverlayConfig, time: number) {
  return (
    config.enabled &&
    config.text.trim() !== "" &&
    (config.fullVideo || time < config.duration)
  );
}

// Animation timings, in seconds.
const WORD_STAGGER = 0.07;
const WORD_IN = 0.35;
const FADE_OUT = 0.3;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;
const easeOutBack = (p: number) => {
  const c1 = 1.70158;
  return 1 + (c1 + 1) * (p - 1) ** 3 + c1 * (p - 1) ** 2;
};

/** Words pop in one after another; Remotion needs this as a function of time. */
function wordMotion(index: number, time: number): CSSProperties {
  const p = clamp01((time - index * WORD_STAGGER) / WORD_IN);
  if (p >= 1) return {};
  const rise = 1 - easeOutCubic(p);
  const scale = 0.85 + 0.15 * easeOutBack(p);
  return {
    opacity: easeOutCubic(p),
    transform: `translateY(${(rise * 0.35).toFixed(3)}em) scale(${scale.toFixed(3)})`,
  };
}

export function TitleOverlay({
  config,
  time,
  frameWidth,
  getFontFamily,
}: {
  config: TitleOverlayConfig;
  /** Seconds since the start of the video. */
  time: number;
  frameWidth: number;
  getFontFamily: (font: string) => string;
}) {
  if (!isTitleVisible(config, time)) return null;

  const { style } = config;
  const fadeOut =
    config.animation && !config.fullVideo
      ? clamp01((config.duration - time) / FADE_OUT)
      : 1;

  const stroke: CSSProperties =
    style.strokeColor && style.strokeWidth
      ? {
          WebkitTextStroke: `${style.strokeWidth}em ${style.strokeColor}`,
          paintOrder: "stroke fill",
        }
      : {};

  let wordIndex = 0;

  return (
    <div
      data-drag-target="title"
      style={{
        position: "absolute",
        left: `${config.positionX}%`,
        top: `${config.positionY}%`,
        transform: "translate(-50%, -50%)",
        width: `${config.width}%`,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: style.backgroundColor ? "0.08em" : 0,
        fontSize: (frameWidth * config.size) / 100,
        lineHeight: 1.15,
        textAlign: "center",
        textTransform: style.textTransform,
        opacity: fadeOut,
      }}
    >
      {parseTitle(config.text).map((line, lineIndex) => (
        <div
          key={lineIndex}
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "baseline",
            columnGap: "0.25em",
            ...(style.backgroundColor
              ? {
                  backgroundColor: style.backgroundColor,
                  padding: "0.1em 0.45em",
                  borderRadius: style.pill ? "9999px" : "0.22em",
                }
              : {}),
          }}
        >
          {line.map((word) => {
            const index = wordIndex++;
            return (
              <span
                key={index}
                style={{
                  display: "inline-block",
                  fontFamily: getFontFamily(
                    word.accent ? style.accentFontFamily : style.fontFamily,
                  ),
                  fontWeight: word.accent
                    ? style.accentFontWeight
                    : style.fontWeight,
                  fontSize:
                    word.accent && style.accentScale
                      ? `${style.accentScale}em`
                      : undefined,
                  color: word.accent ? style.accentColor : style.color,
                  textShadow: style.shadow,
                  ...stroke,
                  ...(word.accent && style.accentBackgroundColor
                    ? {
                        backgroundColor: style.accentBackgroundColor,
                        padding: "0 0.18em",
                        borderRadius: "0.14em",
                      }
                    : {}),
                  ...(config.animation ? wordMotion(index, time) : {}),
                }}
              >
                {word.text}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
