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
  /** Accent words in italics. */
  accentItalic?: boolean;
  /** Color for main-highlight words; a random bright color when missing. */
  mainColor?: string;
  /** Color for second-highlight words; a random bright color when missing. */
  secondColor?: string;
  /** Extra space between letters, in ems. */
  letterSpacing?: number;
}

export interface TitleOverlayConfig {
  /** 2 since sizes use the caption scale and titles have a start time. */
  version?: 2;
  enabled: boolean;
  /** Lines split by "\n". Words wrapped in *asterisks* use the accent style. */
  text: string;
  /** Theme the style started from; "" for titles made before themes. */
  themeId: string;
  style: TitleStyle;
  /** Size on the caption scale, 0 to 80: drawn at size × frame width / 540. */
  size: number;
  /** Centre of the title, as percentages of the frame. */
  positionX: number;
  positionY: number;
  /** Maximum width, as a percentage of the frame width. */
  width: number;
  /** Seconds into the video the title appears. */
  start: number;
  /** Seconds the title stays on screen; ignored when fullVideo is on. */
  duration: number;
  fullVideo: boolean;
  animation: boolean;
  /** Earlier AI hooks, newest first. */
  history: string[];
}

/** Submagic's "Mark" hook title theme, from its rendered CSS. */
export const DEFAULT_TITLE_STYLE: TitleStyle = {
  fontFamily: "tt-fors",
  fontWeight: 900,
  accentFontFamily: "dancing-script",
  accentFontWeight: 400,
  accentItalic: true,
  textTransform: "none",
  color: "#ffffff",
  accentColor: "#ffffff",
  shadow: "rgb(28, 28, 28) 0px 3px 5px",
  // -2px at 96px.
  letterSpacing: -0.0208,
};

// Old titles sized as a percentage of the frame width.
const PERCENT_TO_SIZE = 5.4;

export const TITLE_OVERLAY_DEFAULTS: TitleOverlayConfig = {
  version: 2,
  enabled: true,
  text: "",
  themeId: "mark",
  style: DEFAULT_TITLE_STYLE,
  size: 36,
  positionX: 50,
  positionY: 60,
  width: 84,
  start: 0,
  duration: 2,
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
  // A project that never had a title starts from the defaults.
  if (!raw || Object.keys(stored).length === 0) return TITLE_OVERLAY_DEFAULTS;

  if (stored.style && typeof stored.size === "number") {
    return {
      ...TITLE_OVERLAY_DEFAULTS,
      ...stored,
      version: 2,
      size: stored.version === 2 ? stored.size : stored.size * PERCENT_TO_SIZE,
      start: stored.start ?? 0,
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
    size: Math.round((fontSize / frame.width) * 540),
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

export type TitleHighlight = 1 | 2 | 3;

export interface TitleWord {
  text: string;
  /** 1 main color, 2 second color, 3 the secondary font. */
  level?: TitleHighlight;
  /** True for level 3, which draws in the secondary font. */
  accent: boolean;
}

// How each highlight is written in the stored text: `*third*`, `^main^`, `~second~`.
const MARKS: Record<TitleHighlight, string> = { 1: "^", 2: "~", 3: "*" };
const LEVEL_OF: Record<string, TitleHighlight> = { "^": 1, "~": 2, "*": 3 };

/** Lines of words; marks like `*a b*` set both words' highlight. */
export function parseTitle(text: string): TitleWord[][] {
  return text
    .split("\n")
    .map((line) => {
      const words: TitleWord[] = [];
      for (const match of line.matchAll(/([*^~])([^*^~]+)\1|([^*^~]+)/g)) {
        const level = match[1] ? LEVEL_OF[match[1]] : undefined;
        for (const word of (match[2] ?? match[3]).split(/\s+/)) {
          if (word) words.push({ text: word, level, accent: level === 3 });
        }
      }
      return words;
    })
    .filter((line) => line.length > 0);
}

/** Writes lines back as text, grouping neighbouring words of one highlight. */
export function serializeTitle(lines: TitleWord[][]): string {
  return lines
    .map((line) => {
      const parts: string[] = [];
      let run: string[] = [];
      let runLevel: TitleHighlight | undefined;
      const flush = () => {
        if (!run.length) return;
        parts.push(runLevel ? `${MARKS[runLevel]}${run.join(" ")}${MARKS[runLevel]}` : run.join(" "));
        run = [];
      };
      for (const word of line) {
        if (word.level !== runLevel) {
          flush();
          runLevel = word.level;
        }
        run.push(word.text);
      }
      flush();
      return parts.join(" ");
    })
    .join("\n");
}

// Highlight colors when a theme sets none, picked per word as Submagic's
// "random color" mode does.
const RANDOM_HIGHLIGHTS = ["#facc15", "#22c55e", "#38bdf8", "#f472b6", "#fb923c"];

/** Whether the title is on screen at `time` seconds into the video. */
export function isTitleVisible(config: TitleOverlayConfig, time: number) {
  const start = config.fullVideo ? 0 : (config.start ?? 0);
  return (
    config.enabled &&
    config.text.trim() !== "" &&
    time >= start &&
    (config.fullVideo || time < start + config.duration)
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
  // Animations run from when the title appears.
  const since = time - (config.fullVideo ? 0 : (config.start ?? 0));
  const fadeOut =
    config.animation && !config.fullVideo
      ? clamp01((config.duration - since) / FADE_OUT)
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
        fontSize: (frameWidth * config.size) / 540,
        lineHeight: 1.1,
        letterSpacing: style.letterSpacing ? `${style.letterSpacing}em` : undefined,
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
                  fontStyle: word.accent && style.accentItalic ? "italic" : undefined,
                  fontSize:
                    word.accent && style.accentScale
                      ? `${style.accentScale}em`
                      : undefined,
                  color:
                    word.level === 3
                      ? style.accentColor
                      : word.level === 1
                        ? (style.mainColor ?? RANDOM_HIGHLIGHTS[index % RANDOM_HIGHLIGHTS.length])
                        : word.level === 2
                          ? (style.secondColor ?? RANDOM_HIGHLIGHTS[(index + 2) % RANDOM_HIGHLIGHTS.length])
                          : style.color,
                  textShadow: style.shadow,
                  ...stroke,
                  ...(word.accent && style.accentBackgroundColor
                    ? {
                        backgroundColor: style.accentBackgroundColor,
                        padding: "0 0.18em",
                        borderRadius: "0.14em",
                      }
                    : {}),
                  ...(config.animation ? wordMotion(index, since) : {}),
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
