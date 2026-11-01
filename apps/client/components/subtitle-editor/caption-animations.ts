/**
 * Caption, word, emoji and video-zoom animations as functions of time, so
 * every exported frame matches the preview.
 *
 * Identical copies live in apps/client/components/subtitle-editor and
 * apps/remotion/src. Change both together.
 */
import type { CSSProperties } from "react";
import type {
  CaptionAnimation,
  EmojiAnimation,
  EmphasisAnimation,
  IdleAnimation,
  SubtitleChunk,
  WordAnimation,
  WordEffect,
  ZoomStyle,
} from "./caption-style";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const lerp = (from: number, to: number, p: number) => from + (to - from) * p;
const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;
const easeInCubic = (p: number) => p ** 3;
const easeInOut = (p: number) =>
  p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
const easeOutBack = (p: number, overshoot = 1.70158) =>
  1 + (overshoot + 1) * (p - 1) ** 3 + overshoot * (p - 1) ** 2;
const easeOutElastic = (p: number) =>
  p <= 0 ? 0 : p >= 1 ? 1 : 2 ** (-10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
/** 0 → 1 over `seconds` from `since`. */
const progress = (since: number, seconds: number) => clamp01(since / seconds);
const fmt = (n: number) => Number(n.toFixed(4));

function transform(parts: {
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
}): string | undefined {
  const out: string[] = [];
  if (parts.x || parts.y) out.push(`translate(${fmt(parts.x ?? 0)}em, ${fmt(parts.y ?? 0)}em)`);
  if (parts.scale !== undefined && parts.scale !== 1) out.push(`scale(${fmt(parts.scale)})`);
  if (parts.rotate) out.push(`rotate(${fmt(parts.rotate)}deg)`);
  return out.length ? out.join(" ") : undefined;
}

const wiggle = (since: number, degrees: number, seconds = 0.5) =>
  since >= seconds
    ? 0
    : degrees * Math.sin((since / seconds) * 4 * Math.PI) * (1 - since / seconds);

export interface CaptionMotion {
  /** For the caption box. */
  style: CSSProperties;
  /** For each row, by its index. */
  row?: (row: number) => CSSProperties;
  /** Share of characters typed so far; 1 shows all. */
  reveal?: number;
  /** Opacity of letter `i` of `count`, for letter-by-letter fades. */
  letterOpacity?: (i: number, count: number) => number;
  /** Extra space between letters, in ems. */
  letterSpacing?: number;
  /** How much of a border is drawn round the caption, 0 to 1. */
  border?: number;
}

/**
 * The caption's motion. `since` is seconds since it appeared and `until`
 * seconds until it goes.
 */
export function captionMotion(
  name: CaptionAnimation | undefined,
  since: number,
  until: number,
): CaptionMotion {
  const fadeIn = (seconds: number) => progress(since, seconds);
  switch (name) {
    case undefined:
    case "none":
      return { style: {} };
    case "show-in":
      return { style: { opacity: fadeIn(0.06) } };
    case "appear-in-place": {
      const p = easeOutCubic(fadeIn(0.15));
      return { style: { opacity: p, transform: transform({ scale: lerp(0.96, 1, p) }) } };
    }
    case "pop-in": {
      const p = fadeIn(0.28);
      const scale = p < 0.6 ? lerp(0.6, 1.08, easeOutCubic(p / 0.6)) : lerp(1.08, 1, easeOutCubic((p - 0.6) / 0.4));
      return { style: { opacity: fadeIn(0.08), transform: transform({ scale }) } };
    }
    case "pop-out": {
      const p = easeOutCubic(fadeIn(0.22));
      return { style: { opacity: fadeIn(0.06), transform: transform({ scale: lerp(1.3, 1, p) }) } };
    }
    case "bounce-in": {
      const p = fadeIn(0.4);
      return {
        style: {
          opacity: fadeIn(0.1),
          transform: transform({ y: lerp(0.6, 0, easeOutBack(p, 2.2)), scale: lerp(0.85, 1, easeOutCubic(p)) }),
        },
      };
    }
    case "zoom-out": {
      const p = easeOutCubic(fadeIn(0.3));
      return { style: { opacity: fadeIn(0.12), transform: transform({ scale: lerp(1.5, 1, p) }) } };
    }
    case "zoom-in": {
      const p = easeOutCubic(fadeIn(0.3));
      return { style: { opacity: fadeIn(0.12), transform: transform({ scale: lerp(0.5, 1, p) }) } };
    }
    case "rotate-wiggle":
      return { style: { transform: transform({ rotate: wiggle(since, 8) }) } };
    case "rotate-wiggle-small":
      return { style: { transform: transform({ rotate: wiggle(since, 5) }) } };
    case "rotate-wiggle-mini":
      return { style: { transform: transform({ rotate: wiggle(since, 3) }) } };
    case "rotate-wiggle-scale": {
      const p = easeOutCubic(fadeIn(0.3));
      return { style: { transform: transform({ rotate: wiggle(since, 6), scale: lerp(1.15, 1, p) }) } };
    }
    case "pop-in-zoom": {
      const p = fadeIn(0.25);
      const pop = p < 0.7 ? lerp(0, 1.1, easeOutCubic(p / 0.7)) : lerp(1.1, 1, (p - 0.7) / 0.3);
      return { style: { transform: transform({ scale: pop * (1 + 0.04 * clamp01((since - 0.25) / 2)) }) } };
    }
    case "fade-in":
      return { style: { opacity: easeOutCubic(fadeIn(0.25)) } };
    case "fade-out":
      return { style: { opacity: Math.min(fadeIn(0.1), clamp01(until / 0.25)) } };
    case "scale-bounce":
      return { style: { transform: transform({ scale: lerp(0.7, 1, easeOutElastic(fadeIn(0.6))) }) } };
    case "rotate-left": {
      const p = easeOutBack(fadeIn(0.35));
      return { style: { opacity: fadeIn(0.1), transform: transform({ rotate: lerp(14, 0, p), scale: lerp(0.8, 1, p) }) } };
    }
    case "rotate-right": {
      const p = easeOutBack(fadeIn(0.35));
      return { style: { opacity: fadeIn(0.1), transform: transform({ rotate: lerp(-14, 0, p), scale: lerp(0.8, 1, p) }) } };
    }
    case "rotate-slow-right":
      return { style: { transform: transform({ rotate: 3 * clamp01(since / 2) }) } };
    case "rotate-slow-left":
      return { style: { transform: transform({ rotate: -3 * clamp01(since / 2) }) } };
    case "scale-slow-in":
      return { style: { opacity: fadeIn(0.1), transform: transform({ scale: 1 + 0.08 * clamp01(since / 2) }) } };
    case "slide-up": {
      const p = easeOutCubic(fadeIn(0.25));
      return { style: { opacity: p, transform: transform({ y: lerp(0.5, 0, p) }) } };
    }
    case "slide-up-zoom-out": {
      const p = easeOutCubic(fadeIn(0.3));
      return { style: { opacity: fadeIn(0.12), transform: transform({ y: lerp(0.5, 0, p), scale: lerp(1.3, 1, p) }) } };
    }
    case "slide-up-out": {
      const enter = easeOutCubic(fadeIn(0.25));
      const leave = easeInCubic(1 - clamp01(until / 0.2));
      return {
        style: {
          opacity: Math.min(enter, 1 - leave),
          transform: transform({ y: lerp(0.5, 0, enter) - 0.5 * leave }),
        },
      };
    }
    case "scale-rotate-right": {
      const p = easeOutBack(fadeIn(0.35));
      return { style: { opacity: fadeIn(0.1), transform: transform({ scale: lerp(0.6, 1, p), rotate: lerp(10, 0, p) }) } };
    }
    case "typewriter":
      return { style: {}, reveal: fadeIn(0.5) };
    case "typewriter-simple":
      return { style: {}, reveal: fadeIn(0.3) };
    case "slide-left-in-typewriter": {
      const p = easeOutCubic(fadeIn(0.3));
      return { style: { transform: transform({ x: lerp(1, 0, p) }) }, reveal: fadeIn(0.45) };
    }
    case "letter-fade-in":
      return {
        style: {},
        letterOpacity: (i, count) => clamp01((since - (i / Math.max(1, count)) * 0.35) / 0.12),
      };
    case "screw-in": {
      const p = easeOutBack(fadeIn(0.4));
      return { style: { opacity: fadeIn(0.1), transform: transform({ rotate: lerp(90, 0, p), scale: lerp(0.3, 1, p) }) } };
    }
    case "letter-spacing-in": {
      const p = easeOutCubic(fadeIn(0.35));
      return { style: { opacity: p }, letterSpacing: lerp(0.4, 0, p) };
    }
    case "letter-spacing-bounce-in": {
      const p = easeOutBack(fadeIn(0.45), 2.5);
      return { style: { opacity: fadeIn(0.15) }, letterSpacing: lerp(0.4, 0, p) };
    }
    case "letter-spacing-large-in": {
      const p = easeOutCubic(fadeIn(0.45));
      return { style: { opacity: p }, letterSpacing: lerp(1, 0, p) };
    }
    case "beast-bounce-in": {
      const p = fadeIn(0.45);
      const scale =
        p < 0.45 ? lerp(0, 1.25, easeOutCubic(p / 0.45))
        : p < 0.75 ? lerp(1.25, 0.95, (p - 0.45) / 0.3)
        : lerp(0.95, 1, (p - 0.75) / 0.25);
      return { style: { transform: transform({ scale, rotate: lerp(-6, 0, easeOutCubic(p)) }) } };
    }
    case "slide-right-bounce": {
      const p = easeOutBack(fadeIn(0.4), 2);
      return { style: { opacity: fadeIn(0.1), transform: transform({ x: lerp(-1.2, 0, p) }) } };
    }
    case "slide-right-dust": {
      const p = easeOutCubic(fadeIn(0.35));
      return {
        style: {
          opacity: p,
          transform: transform({ x: lerp(-1, 0, p) }),
          filter: p < 1 ? `blur(${fmt(6 * (1 - p))}px)` : undefined,
        },
      };
    }
    case "slide-up-wiggle": {
      const p = easeOutCubic(fadeIn(0.25));
      return {
        style: {
          opacity: p,
          transform: transform({ y: lerp(0.5, 0, p), rotate: wiggle(Math.max(0, since - 0.2), 4) }),
        },
      };
    }
    case "slide-up-in": {
      const p = easeOutCubic(fadeIn(0.3));
      return { style: { opacity: p, transform: transform({ y: lerp(1, 0, p) }) } };
    }
    case "blink-fade": {
      const steps = [0, 1, 0.25, 1, 0.5, 1];
      const i = Math.floor(since / 0.05);
      return { style: { opacity: i < steps.length ? steps[i] : 1 } };
    }
    case "border-reveal":
      return { style: { opacity: fadeIn(0.1) }, border: easeInOut(fadeIn(0.45)) };
    case "slide-right-in": {
      const p = easeOutCubic(fadeIn(0.25));
      return { style: { opacity: p, transform: transform({ x: lerp(-0.8, 0, p) }) } };
    }
    case "rotate-idle-wiggle":
      return {
        style: {
          opacity: fadeIn(0.1),
          transform: transform({ rotate: 2 * Math.sin(since * 2 * Math.PI * 1.2) }),
        },
      };
    case "benie-rise": {
      const p = easeOutCubic(fadeIn(0.4));
      return { style: { opacity: p, transform: transform({ y: lerp(0.35, 0, p) }) } };
    }
    case "benie-blur-rise": {
      const p = easeOutCubic(fadeIn(0.45));
      return {
        style: {
          opacity: p,
          transform: transform({ y: lerp(0.35, 0, p) }),
          filter: p < 1 ? `blur(${fmt(10 * (1 - p))}px)` : undefined,
        },
      };
    }
    case "benie-keyword": {
      const p = easeOutCubic(fadeIn(0.3));
      return {
        style: {
          opacity: fadeIn(0.12),
          transform: transform({ scale: lerp(1.8, 1, p) }),
          filter: p < 1 ? `blur(${fmt(8 * (1 - p))}px)` : undefined,
        },
      };
    }
    case "benie-glow-flicker": {
      const steps = [0.2, 1, 0.4, 1, 0.7, 1];
      const i = Math.floor(since / 0.06);
      const k = i < steps.length ? steps[i] : 1;
      const glow = 0.5 * (1 - clamp01((since - 0.36) / 0.4));
      return {
        style: {
          opacity: k,
          filter: glow > 0 ? `drop-shadow(0 0 ${fmt(0.25 * glow)}em currentColor)` : undefined,
        },
      };
    }
    case "mark-keyword": {
      const p = easeOutBack(fadeIn(0.22), 1.2);
      return {
        style: {
          opacity: fadeIn(0.06),
          transform: transform({ scale: lerp(2.2, 1, p), rotate: wiggle(Math.max(0, since - 0.18), 3, 0.35) }),
        },
      };
    }
    case "mark-line-pop":
      return { style: {}, row: (row) => rowPop(since - row * 0.12, 1.12) };
    case "mark-lines-pop":
      return { style: {}, row: (row) => rowPop(since - row * 0.06, 1.25) };

    // Used by templates; not in the menu.
    case "scale-in-drift": {
      const p = easeOutCubic(fadeIn(0.2));
      return {
        style: {
          opacity: fadeIn(0.08),
          transform: transform({ scale: lerp(0.85, 1, p) * (1 + 0.05 * clamp01(since / 2)) }),
        },
      };
    }
    case "bounce-in-soft": {
      const p = fadeIn(0.35);
      return { style: { opacity: fadeIn(0.1), transform: transform({ y: lerp(0.3, 0, easeOutBack(p, 1.2)) }) } };
    }
    case "bounce-in-elastic":
      return { style: { opacity: fadeIn(0.08), transform: transform({ scale: lerp(0.6, 1, easeOutElastic(fadeIn(0.6))) }) } };
    case "bounce-in-pop":
    case "williamv2-batch1":
    case "mattv2-batch1": {
      const p = fadeIn(0.28);
      const scale = p < 0.6 ? lerp(0.5, 1.15, easeOutCubic(p / 0.6)) : lerp(1.15, 1, (p - 0.6) / 0.4);
      return { style: { opacity: fadeIn(0.08), transform: transform({ scale }) } };
    }
    case "slide-up-in-slow": {
      const p = easeOutCubic(fadeIn(0.6));
      return { style: { opacity: p, transform: transform({ y: lerp(0.6, 0, p) }) } };
    }
    case "slide-up-fade-in":
    case "williamv2-batch2":
    case "mattv2-batch3": {
      const p = easeOutCubic(fadeIn(0.3));
      return { style: { opacity: p, transform: transform({ y: lerp(0.3, 0, p) }) } };
    }
    case "iman-keyword-in": {
      const p = easeOutCubic(fadeIn(0.35));
      return {
        style: {
          opacity: fadeIn(0.12),
          transform: transform({ scale: lerp(1.4, 1, p) }),
          filter: p < 1 ? `blur(${fmt(6 * (1 - p))}px)` : undefined,
        },
      };
    }
    case "ali-slide-in":
    case "williamv2-batch3": {
      const p = easeOutCubic(fadeIn(0.25));
      return { style: { opacity: p, transform: transform({ x: lerp(-0.4, 0, p) }) } };
    }
    case "ali-scale-in": {
      const p = easeOutCubic(fadeIn(0.25));
      return { style: { opacity: p, transform: transform({ scale: lerp(0.8, 1, p) }) } };
    }
    case "williamv2-batch4": {
      const p = easeOutCubic(fadeIn(0.3));
      return { style: { opacity: fadeIn(0.12), transform: transform({ scale: lerp(1.5, 1, p) }) } };
    }
    case "williamv2-batch5":
    case "mattv2-batch2": {
      const p = easeOutCubic(fadeIn(0.15));
      return { style: { opacity: p, transform: transform({ scale: lerp(0.96, 1, p) }) } };
    }
    case "beast-slide-up-bounce-in": {
      const p = fadeIn(0.45);
      const scale = p < 0.5 ? lerp(0.4, 1.2, easeOutCubic(p / 0.5)) : lerp(1.2, 1, easeOutCubic((p - 0.5) / 0.5));
      return { style: { opacity: fadeIn(0.08), transform: transform({ y: lerp(0.6, 0, easeOutCubic(p)), scale }) } };
    }
    case "nora-rise": {
      const p = easeOutCubic(fadeIn(0.5));
      return { style: { opacity: p, transform: transform({ y: lerp(0.4, 0, p) }) } };
    }
    default:
      return { style: {} };
  }
}

function rowPop(since: number, peak: number): CSSProperties {
  if (since < 0) return { opacity: 0 };
  const p = clamp01(since / 0.25);
  const scale = p < 0.6 ? lerp(0.6, peak, easeOutCubic(p / 0.6)) : lerp(peak, 1, (p - 0.6) / 0.4);
  return { opacity: clamp01(since / 0.06), transform: transform({ scale }) };
}

// Stagger animations reveal a caption's words one after another from when
// it appears, this far apart, instead of as each is spoken.
const STAGGER_SECONDS = 0.06;

/**
 * A word's appearance as it's spoken. `since` is seconds since the word
 * started; before that the word holds its starting state, still taking up
 * its space so the caption doesn't reflow. `sinceCaption` and `index` are
 * for animations that stagger the words.
 */
export function wordMotion(
  name: WordAnimation | undefined,
  since: number,
  sinceCaption = since,
  index = 0,
): CSSProperties {
  if (!name || name === "none") return {};
  if (name === "opacity-30") return { opacity: since < 0 ? 0.3 : 1 };
  if (name === "mattv2-stagger-appear" || name === "mattv2-stagger-slide-up") {
    const t = sinceCaption - index * STAGGER_SECONDS;
    if (t < 0) return { opacity: 0 };
    const p = easeOutCubic(progress(t, 0.15));
    return name === "mattv2-stagger-appear"
      ? { opacity: p }
      : { opacity: p, transform: transform({ y: lerp(0.3, 0, p) }) };
  }
  if (since < 0) return { opacity: 0 };
  switch (name) {
    case "show-in":
      return { opacity: progress(since, 0.08) };
    case "show-in-fast":
      return {};
    case "fade-in":
      return { opacity: easeOutCubic(progress(since, 0.2)) };
    case "fade-in-fast":
      return { opacity: progress(since, 0.1) };
    case "fade-in-linear-fast":
      return { opacity: progress(since, 0.12) };
    case "zoom-in": {
      const p = easeOutCubic(progress(since, 0.2));
      return { opacity: p, transform: transform({ scale: lerp(0.4, 1, p) }) };
    }
    case "slide-up": {
      const p = easeOutCubic(progress(since, 0.25));
      return { opacity: p, transform: transform({ y: lerp(0.4, 0, p) }) };
    }
    case "slide-up-fast": {
      const p = easeOutCubic(progress(since, 0.12));
      return { opacity: p, transform: transform({ y: lerp(0.4, 0, p) }) };
    }
    case "slide-up-micro": {
      const p = easeOutCubic(progress(since, 0.18));
      return { opacity: p, transform: transform({ y: lerp(0.15, 0, p) }) };
    }
    case "slide-up-in": {
      const p = easeOutCubic(progress(since, 0.3));
      return { opacity: p, transform: transform({ y: lerp(0.6, 0, p) }) };
    }
    case "slide-up-in-fast": {
      const p = easeOutCubic(progress(since, 0.15));
      return { opacity: p, transform: transform({ y: lerp(0.6, 0, p) }) };
    }
    case "white-flash-reveal": {
      const p = progress(since, 0.25);
      return { filter: p < 1 ? `brightness(${fmt(lerp(3, 1, easeOutCubic(p)))})` : undefined };
    }
    case "slide-right-dust": {
      const p = easeOutCubic(progress(since, 0.25));
      return {
        opacity: p,
        transform: transform({ x: lerp(-0.5, 0, p) }),
        filter: p < 1 ? `blur(${fmt(4 * (1 - p))}px)` : undefined,
      };
    }
    case "slide-right-in": {
      const p = easeOutCubic(progress(since, 0.2));
      return { opacity: p, transform: transform({ x: lerp(-0.4, 0, p) }) };
    }
    case "pop-in-scale": {
      const p = progress(since, 0.22);
      const scale = p < 0.6 ? lerp(0, 1.15, easeOutCubic(p / 0.6)) : lerp(1.15, 1, (p - 0.6) / 0.4);
      return { transform: transform({ scale }) };
    }
    case "pop-in-scale-reverse": {
      const p = easeOutCubic(progress(since, 0.22));
      return { opacity: progress(since, 0.08), transform: transform({ scale: lerp(1.8, 1, p) }) };
    }
    case "nora-slide-in": {
      const p = easeOutCubic(progress(since, 0.3));
      return {
        opacity: p,
        transform: transform({ x: lerp(0.3, 0, p) }),
        filter: p < 1 ? `blur(${fmt(3 * (1 - p))}px)` : undefined,
      };
    }
    case "mattv2-keyword": {
      const p = easeOutCubic(progress(since, 0.25));
      return { opacity: progress(since, 0.08), transform: transform({ scale: lerp(1.3, 1, p) }) };
    }
    case "dan2-keyword-bounce": {
      const p = progress(since, 0.35);
      return { transform: transform({ y: -0.25 * Math.sin(Math.PI * p), scale: 1 + 0.1 * Math.sin(Math.PI * p) }) };
    }
    case "sara-slide-up-blur": {
      const p = easeOutCubic(progress(since, 0.3));
      return {
        opacity: p,
        transform: transform({ y: lerp(0.3, 0, p) }),
        filter: p < 1 ? `blur(${fmt(4 * (1 - p))}px)` : undefined,
      };
    }
    case "sara-keyword": {
      const p = progress(since, 0.4);
      return {
        opacity: progress(since, 0.1),
        transform: transform({ scale: lerp(1.15, 1, easeOutCubic(p)) }),
        filter: p < 1 ? `brightness(${fmt(lerp(1.6, 1, p))})` : undefined,
      };
    }
    case "beast-keyword-bounce": {
      const p = progress(since, 0.4);
      const scale = p < 0.5 ? lerp(0, 1.3, easeOutCubic(p / 0.5)) : lerp(1.3, 1, (p - 0.5) / 0.5);
      return { transform: transform({ scale, rotate: wiggle(since, 8, 0.5) }) };
    }
    case "bob-keyword-elastic":
      return { transform: transform({ scale: lerp(0.4, 1, easeOutElastic(progress(since, 0.6))) }) };
    case "bob-slide-up": {
      const p = progress(since, 0.3);
      return { opacity: progress(since, 0.1), transform: transform({ y: lerp(0.5, 0, easeOutBack(p)) }) };
    }
    default:
      return {};
  }
}

/** A loop that runs while the caption is on screen. */
export function idleMotion(
  name: IdleAnimation | undefined,
  since: number,
): CSSProperties {
  switch (name) {
    case "dan-wiggle":
      return { transform: transform({ rotate: 1.5 * Math.sin(since * 2 * Math.PI * 1.5) }) };
    case "dan2-wiggle":
      return { transform: transform({ rotate: 3 * Math.sin(since * 2 * Math.PI * 2) }) };
    case "laura2-wiggle":
      return {
        transform: transform({
          rotate: 1.2 * Math.sin(since * 2 * Math.PI),
          scale: 1 + 0.02 * Math.sin(since * 2 * Math.PI),
        }),
      };
    default:
      return {};
  }
}

/** How an emphasized line comes in. */
export function emphasisLineMotion(
  name: EmphasisAnimation | undefined,
  since: number,
): CaptionMotion {
  switch (name) {
    case "fade-in":
      return { style: { opacity: easeOutCubic(progress(since, 0.3)) } };
    case "slide-up": {
      const p = easeOutCubic(progress(since, 0.3));
      return { style: { opacity: p, transform: transform({ y: lerp(0.4, 0, p) }) } };
    }
    case "cinematic": {
      const p = easeOutCubic(progress(since, 0.6));
      return {
        style: {
          opacity: p,
          filter: p < 1 ? `blur(${fmt(8 * (1 - p))}px)` : undefined,
        },
        letterSpacing: lerp(0.3, 0, p),
      };
    }
    case "drawer": {
      const p = easeInOut(progress(since, 0.35));
      return { style: { clipPath: p < 1 ? `inset(-0.5em ${fmt((1 - p) * 100)}% -0.5em -0.5em)` : undefined } };
    }
    default:
      return captionMotion("pop-in", since, Infinity);
  }
}

// Word effect timings, in seconds from when the word is spoken.
const EFFECT_SECONDS = 0.4;
const GLOW_SECONDS = 0.9;

/** A single word's effect chosen in the transcript. */
export function wordEffectStyle(
  effect: WordEffect,
  since: number,
  glowColor: string,
  baseShadow: string | undefined,
): CSSProperties {
  if (since < 0) return {};
  const p = clamp01(since / EFFECT_SECONDS);
  if (effect === "glow") {
    if (since >= GLOW_SECONDS) return {};
    const k =
      since < 0.12
        ? since / 0.12
        : 1 - clamp01((since - 0.12) / (GLOW_SECONDS - 0.12));
    const glow = `0 0 ${(0.25 * k).toFixed(3)}em ${glowColor}, 0 0 ${(0.6 * k).toFixed(3)}em ${glowColor}`;
    return {
      textShadow: baseShadow ? `${glow}, ${baseShadow}` : glow,
      transform: `scale(${(1 + 0.06 * k).toFixed(3)})`,
    };
  }
  if (p >= 1) return {};
  switch (effect) {
    case "pop": {
      const scale =
        p < 0.4
          ? lerp(0.7, 1.3, easeOutCubic(p / 0.4))
          : lerp(1.3, 1, easeOutCubic((p - 0.4) / 0.6));
      return { transform: `scale(${scale.toFixed(3)})` };
    }
    case "bounce":
      return {
        transform: `translateY(${(-0.4 * Math.sin(Math.PI * p)).toFixed(3)}em)`,
      };
    case "shake":
      return {
        transform: `rotate(${(8 * Math.sin(p * 6 * Math.PI) * (1 - p)).toFixed(2)}deg)`,
      };
    case "zoom":
      return {
        transform: `scale(${lerp(1.8, 1, easeOutCubic(p)).toFixed(3)})`,
        opacity: clamp01(p * 3),
      };
    case "swing":
      return {
        transform: `rotate(${(-14 * (1 - easeOutBack(p))).toFixed(2)}deg)`,
        transformOrigin: "50% 100%",
      };
    default:
      return {};
  }
}

export function emojiMotion(
  name: EmojiAnimation | undefined,
  since: number,
  idle: boolean,
): CSSProperties {
  const idleRotate = idle ? 6 * Math.sin(since * 2 * Math.PI * 0.8) : 0;
  const idleY = idle ? -0.04 * Math.sin(since * 2 * Math.PI * 1.1) : 0;
  switch (name) {
    case "bounce-in":
    case "bounce-in-wiggle": {
      const p = progress(since, 0.4);
      const scale = p < 0.6 ? lerp(0, 1.2, easeOutCubic(p / 0.6)) : lerp(1.2, 1, (p - 0.6) / 0.4);
      const rotate = name === "bounce-in-wiggle" ? wiggle(Math.max(0, since - 0.25), 12, 0.6) : 0;
      return { transform: transform({ y: lerp(0.3, 0, easeOutCubic(p)) + idleY, scale, rotate: rotate + idleRotate }) };
    }
    case "fade-in":
      return { opacity: easeOutCubic(progress(since, 0.25)), transform: transform({ y: idleY, rotate: idleRotate }) };
    case "slide-up": {
      const p = easeOutCubic(progress(since, 0.3));
      return { opacity: p, transform: transform({ y: lerp(0.4, 0, p) + idleY, rotate: idleRotate }) };
    }
    case "beast-bounce": {
      const p = progress(since, 0.4);
      const scale = p < 0.5 ? lerp(0, 1.3, easeOutCubic(p / 0.5)) : lerp(1.3, 1, (p - 0.5) / 0.5);
      return { transform: transform({ y: idleY, scale, rotate: lerp(-15, 0, easeOutCubic(p)) + idleRotate }) };
    }
    default:
      return { transform: transform({ y: idleY, rotate: idleRotate }) };
  }
}

// Video zoom ---------------------------------------------------------------

const ZOOM_GAP_SECONDS = 2.5;
const ZOOM_SECONDS = 2.5;
const PLAIN_ZOOMS: Exclude<ZoomStyle, "none" | "random-zoom">[] = [
  "zoom-fast", "crash-zoom", "expo-zoom", "crash-zoom-out", "smooth-zoom-in",
  "fast-snap", "fast-hold", "smooth-pulse", "smooth-hold", "quick-in",
  "ramp-ease", "steady-hold", "steady-ease", "steady-snap", "smooth-in",
  "smooth-out", "steady-in", "steady-out", "camera-shake", "slide-top",
  "slide-bottom", "slide-left", "slide-right",
];

/**
 * When the video zooms: at solo keywords and captions with a main keyword,
 * at least a couple of seconds apart, or every fourth caption when the
 * transcript has no keywords yet.
 */
export function zoomMoments(chunks: SubtitleChunk[]): number[] {
  const visible = chunks.filter((c) => !c.hidden && c.words.length);
  const keyed = visible.filter(
    (c) => c.solo || c.words.some((w) => w.keyword === 1),
  );
  const candidates = (keyed.length ? keyed : visible.filter((_, i) => i % 4 === 0)).map(
    (c) => c.start,
  );
  const moments: number[] = [];
  for (const time of candidates) {
    if (!moments.length || time - moments[moments.length - 1] >= ZOOM_GAP_SECONDS) {
      moments.push(time);
    }
  }
  return moments;
}

/** A zoom that starts at `start` and settles back by `end`. */
export interface ZoomEvent {
  start: number;
  end: number;
  type: ZoomStyle;
}

/** Zooms of one style at the transcript's key moments. */
export function zoomEvents(chunks: SubtitleChunk[], style: ZoomStyle | undefined): ZoomEvent[] {
  if (!style || style === "none") return [];
  const moments = zoomMoments(chunks);
  return moments.map((start, i) => ({
    start,
    end: Math.min(start + ZOOM_SECONDS, moments[i + 1] ?? Infinity),
    type:
      style === "random-zoom" ? PLAIN_ZOOMS[(i * 7 + 3) % PLAIN_ZOOMS.length] : style,
  }));
}

/** The video's transform at `time`. */
export function zoomTransform(time: number, events: ZoomEvent[]): string | undefined {
  const event = events.find((e) => time >= e.start && time < e.end);
  if (!event || event.type === "none") return undefined;
  const kind =
    event.type === "random-zoom"
      ? PLAIN_ZOOMS[Math.floor(event.start * 10) % PLAIN_ZOOMS.length]
      : event.type;
  const since = time - event.start;
  const span = event.end - event.start;
  const p = since / span;
  // Ease back out over the last part so the cut to the next moment is smooth.
  const settle = 1 - easeInOut(clamp01((p - 0.8) / 0.2));
  const { scale = 1, x = 0, y = 0, rotate = 0 } = zoomShape(kind, since, p);
  const s = 1 + (scale - 1) * settle;
  const parts = [
    `scale(${fmt(s)})`,
    x || y ? `translate(${fmt(x * settle)}%, ${fmt(y * settle)}%)` : "",
    rotate ? `rotate(${fmt(rotate * settle)}deg)` : "",
  ].filter(Boolean);
  return parts.join(" ");
}

function zoomShape(
  kind: Exclude<ZoomStyle, "none" | "random-zoom">,
  since: number,
  p: number,
): { scale?: number; x?: number; y?: number; rotate?: number } {
  switch (kind) {
    case "zoom-fast":
      return { scale: lerp(1, 1.18, easeOutCubic(progress(since, 0.25))) };
    case "crash-zoom":
      return { scale: lerp(1, 1.3, easeOutCubic(progress(since, 0.12))) };
    case "expo-zoom":
      return { scale: lerp(1, 1.25, easeInCubic(progress(since, 0.6))) };
    case "crash-zoom-out":
      return { scale: lerp(1.3, 1.02, easeOutCubic(progress(since, 0.25))) };
    case "smooth-zoom-in":
      return { scale: lerp(1, 1.15, easeInOut(p)) };
    case "fast-snap":
      return { scale: since < 0.08 ? 1 : 1.2 };
    case "fast-hold":
      return { scale: lerp(1, 1.2, easeOutCubic(progress(since, 0.18))) };
    case "smooth-pulse":
      return { scale: 1 + 0.12 * Math.sin(Math.PI * p) };
    case "smooth-hold":
      return { scale: lerp(1, 1.15, easeInOut(progress(since, 0.6))) };
    case "quick-in":
      return { scale: lerp(1, 1.12, easeOutCubic(progress(since, 0.15))) };
    case "ramp-ease":
      return { scale: lerp(1, 1.2, easeInOut(progress(since, 1.2))) };
    case "steady-hold":
      return { scale: 1.1 };
    case "steady-ease":
      return { scale: lerp(1, 1.1, easeInOut(progress(since, 0.8))) };
    case "steady-snap":
      return { scale: since < 0.05 ? 1 : 1.1 };
    case "smooth-in":
      return { scale: lerp(1, 1.1, easeOutCubic(p)) };
    case "smooth-out":
      return { scale: lerp(1.15, 1, easeOutCubic(p)) };
    case "steady-in":
      return { scale: lerp(1, 1.08, p) };
    case "steady-out":
      return { scale: lerp(1.1, 1, p) };
    case "camera-shake": {
      const k = 1 - clamp01(since / 0.6);
      return {
        scale: 1.06,
        x: 1.2 * k * Math.sin(since * 2 * Math.PI * 9),
        y: 0.9 * k * Math.cos(since * 2 * Math.PI * 11),
        rotate: 0.8 * k * Math.sin(since * 2 * Math.PI * 7),
      };
    }
    case "slide-top":
      return { scale: 1.12, y: lerp(4, -4, easeInOut(p)) };
    case "slide-bottom":
      return { scale: 1.12, y: lerp(-4, 4, easeInOut(p)) };
    case "slide-left":
      return { scale: 1.12, x: lerp(4, -4, easeInOut(p)) };
    case "slide-right":
      return { scale: 1.12, x: lerp(-4, 4, easeInOut(p)) };
  }
}
