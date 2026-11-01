/**
 * Draws the caption on screen at a moment of the video, for the editor
 * preview and the export alike.
 *
 * Identical copies live in apps/client/components/subtitle-editor and
 * apps/remotion/src. Change both together.
 */
import React from "react";
import { Audio, Sequence, useVideoConfig } from "remotion";
import {
  captionMotion,
  emojiMotion,
  emphasisLineMotion,
  idleMotion,
  wordEffectStyle,
  wordMotion,
  type CaptionMotion,
} from "./caption-animations";
import {
  DEFAULT_CAPTION_WIDTH,
  LINE_SIZE_SCALE,
  presetShadow,
  presetStrokeEm,
  sizeToPixels,
  soundPath,
  soundVolume,
  type CaptionPlacement,
  type CaptionVariant,
  type SubtitleChunk,
  type SubtitleStylePreset,
  type WordAnimation,
  type WordTimestamp,
} from "./caption-style";

// A caption held through a silence stays up at most this long after its
// last word.
const MAX_SILENCE_HOLD = 2;
const BOX_PADDING_X = 0.16;
const LINE_HEIGHT = 1.15;
// A line of one word is drawn this much larger (Submagic's singleWordLineScale).
const SINGLE_WORD_SCALE = 1.4;
const EMPHASIS_SCALE = 1.3;
const EMOJI_SCALE = 1.4;
// Tilt of the left and right rotation variants, and of alternating captions.
const VARIANT_TILT = 4;
const ALTERNATE_TILT = 2;
const ALTERNATE_LIFT_EM = 0.15;
const MOTION_BLUR_PX = 3;
const MOTION_BLUR_SECONDS = 0.15;
const ROTATION_ORDER: CaptionVariant[] = ["horizontal", "left", "horizontal", "right", "fourth"];
type EmojiPlace = "top" | "bottom" | "left" | "right";
const AUTO_EMOJI_ORDER: EmojiPlace[] = ["top", "bottom", "left", "right"];

/** The caption on screen at `time`, if any, and when it goes. */
export function activeCaption(
  chunks: SubtitleChunk[],
  time: number,
  keepThroughSilences: (chunk: SubtitleChunk) => boolean,
): { index: number; until: number } | null {
  let index = -1;
  for (let i = 0; i < chunks.length && chunks[i].start <= time; i++) index = i;
  if (index < 0) return null;
  const chunk = chunks[index];
  const nextStart = chunks[index + 1]?.start ?? Infinity;
  const until = keepThroughSilences(chunk)
    ? Math.min(nextStart, chunk.end + MAX_SILENCE_HOLD)
    : chunk.end;
  return time <= until ? { index, until } : null;
}

function captionEmoji(
  chunk: SubtitleChunk,
  style: SubtitleStylePreset,
): string | undefined {
  if (chunk.emoji) return chunk.emoji;
  if (!style.emojis) return undefined;
  return chunk.words.find((w) => w.emoji)?.emoji;
}

function emojiPlace(
  chunk: SubtitleChunk,
  index: number,
  style: SubtitleStylePreset,
): EmojiPlace {
  if (chunk.solo && style.soloVariant?.startsWith("emoji-")) {
    const place = style.soloVariant.slice("emoji-".length);
    if (place !== "none") return place as EmojiPlace;
  }
  if (style.emojis?.position !== "auto") return "top";
  if (style.emojis.randomTopBottom) {
    // Steady per caption, so the export matches the preview.
    return Math.abs(Math.sin(index * 12.9898) * 43758.5453) % 1 > 0.5 ? "top" : "bottom";
  }
  return AUTO_EMOJI_ORDER[index % AUTO_EMOJI_ORDER.length];
}

/** Which of the template's variants caption `index` plays. */
export function captionVariant(
  chunks: SubtitleChunk[],
  index: number,
  style: SubtitleStylePreset,
): CaptionVariant {
  const chunk = chunks[index];
  if (chunk.solo) return "solo";
  const keys = Object.keys(style.variants ?? {}) as CaptionVariant[];
  if (keys.some((key) => key.startsWith("emoji-"))) {
    return captionEmoji(chunk, style)
      ? (`emoji-${emojiPlace(chunk, index, style)}` as CaptionVariant)
      : "emoji-none";
  }
  const order = ROTATION_ORDER.filter((key) => keys.includes(key));
  return order.length ? order[index % order.length] : "horizontal";
}

function plainColor(value: string | undefined): value is string {
  return Boolean(value) && !value!.startsWith("linear-gradient");
}

function luminance(color: string): number | undefined {
  const hex = color.match(/^#([0-9a-f]{6})/i)?.[1];
  if (!hex) return undefined;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Text that reads on a colored box: dark on light boxes, light on dark ones. */
function textOn(box: string, fontColor: string): string {
  const boxLight = luminance(box);
  if (boxLight === undefined) return fontColor;
  if (boxLight > 0.6) return "#111111";
  const fontLight = luminance(fontColor);
  return fontLight !== undefined && fontLight < 0.4 ? "#ffffff" : fontColor;
}

const sameColor = (a: string | undefined, b: string | undefined) =>
  Boolean(a && b) && a!.toLowerCase() === b!.toLowerCase();

function fill(color: string): React.CSSProperties {
  return color.startsWith("linear-gradient")
    ? {
        backgroundImage: color,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }
    : { color };
}

function merge(...styles: React.CSSProperties[]): React.CSSProperties {
  const merged = Object.assign({}, ...styles) as React.CSSProperties;
  const transforms = styles.map((s) => s.transform).filter(Boolean);
  if (transforms.length) merged.transform = transforms.join(" ");
  const filters = styles.map((s) => s.filter).filter(Boolean);
  if (filters.length) merged.filter = filters.join(" ");
  return merged;
}

export function CaptionsLayer({
  chunks,
  time,
  preset,
  placement,
  frameWidth,
  getFontFamily,
}: {
  chunks: SubtitleChunk[];
  /** Seconds into the video. */
  time: number;
  preset: SubtitleStylePreset;
  placement: CaptionPlacement;
  frameWidth: number;
  getFontFamily: (font: string) => string;
}) {
  const active = activeCaption(
    chunks,
    time,
    (chunk) => (chunk.style ?? preset).keepThroughSilences !== false,
  );
  if (!active) return null;
  const chunk = chunks[active.index];
  if (chunk.hidden || !chunk.words.length) return null;
  const style = chunk.style ?? preset;

  const variant = captionVariant(chunks, active.index, style);
  const base = style.animation;
  const override =
    base && (base.variants || variant === "solo") ? style.variants?.[variant] : undefined;
  const wordAnimation: WordAnimation | undefined = base
    ? chunk.solo && style.soloWordAnimation
      ? style.soloWordAnimation
      : (override?.word ?? base.word)
    : undefined;
  const emojiAnimation = base ? (override?.emoji ?? style.emojis?.entrance) : undefined;
  const idle = base ? (override?.idle ?? style.idle) : undefined;

  const since = time - chunk.start;
  const motion: CaptionMotion = chunk.emphasize
    ? emphasisLineMotion(style.emphasis?.animation, since)
    : base
      ? captionMotion(override?.caption ?? base.caption, since, active.until - time)
      : { style: {} };

  const emoji = captionEmoji(chunk, style);
  const place = emojiPlace(chunk, active.index, style);

  const fontSize =
    sizeToPixels(placement.size, frameWidth) *
    LINE_SIZE_SCALE[chunk.size ?? "medium"] *
    (chunk.words.length === 1 ? SINGLE_WORD_SCALE : 1) *
    (chunk.emphasize ? EMPHASIS_SCALE : 1);

  const odd = active.index % 2 === 1;
  const tilt =
    (variant === "left" ? -VARIANT_TILT : variant === "right" ? VARIANT_TILT : 0) +
    (style.alternate === "rotate" ? (odd ? -ALTERNATE_TILT : ALTERNATE_TILT) : 0);
  const lift = style.alternate === "updown" && odd ? -ALTERNATE_LIFT_EM : 0;
  const blur =
    style.motionBlur && since < MOTION_BLUR_SECONDS
      ? `blur(${(MOTION_BLUR_PX * (1 - since / MOTION_BLUR_SECONDS)).toFixed(2)}px)`
      : undefined;

  let activeWord = -1;
  for (let i = 0; i < chunk.words.length; i++) {
    if (time >= chunk.words[i].start) activeWord = i;
    else break;
  }

  const rows: { word: WordTimestamp; index: number }[][] = [[]];
  chunk.words.forEach((word, index) => {
    rows[rows.length - 1].push({ word, index });
    if (word.lineBreak && index < chunk.words.length - 1) rows.push([]);
  });

  const display = (word: WordTimestamp) =>
    word.word + (style.showPunctuation ? (word.punctuation ?? "") : "");
  const totalLetters = chunk.words.reduce((n, w) => n + display(w).length, 0);
  let lettersBefore = 0;

  const emphasisBox =
    chunk.emphasize && style.emphasis && style.emphasis.background !== "transparent"
      ? style.emphasis.background
      : undefined;
  const lineBox = emphasisBox ?? style.backgroundColor;
  const box: React.CSSProperties = lineBox
    ? {
        backgroundColor: lineBox,
        padding: "0.12em 0.35em",
        borderRadius: `${style.backgroundRadius ?? 0.2}em`,
        ...(emphasisBox ? { backdropFilter: "blur(10px)" } : {}),
      }
    : {};

  const rowsBlock = (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        rowGap: "0.04em",
        ...box,
      }}
    >
      {motion.border !== undefined ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: "-0.12em -0.3em",
            border: `0.06em solid ${plainColor(style.keywordColors?.[0]) ? style.keywordColors![0] : "#ffffff"}`,
            borderRadius: "0.2em",
            clipPath: `inset(0 ${((1 - motion.border) * 100).toFixed(2)}% 0 0)`,
          }}
        />
      ) : null}
      {rows.map((row, r) => (
        <div
          key={r}
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            columnGap: "0.28em",
            ...motion.row?.(r),
          }}
        >
          {row.map(({ word, index }) => {
            const text = display(word);
            const first = lettersBefore;
            lettersBefore += text.length;
            return (
              <Word
                key={`${index}-${word.word}`}
                word={word}
                index={index}
                text={text}
                firstLetter={first}
                totalLetters={totalLetters}
                isActive={index === activeWord}
                time={time}
                sinceCaption={since}
                style={style}
                emphasize={Boolean(chunk.emphasize)}
                fontSize={fontSize}
                getFontFamily={getFontFamily}
                wordAnimation={
                  word.keyword && style.keywordAnimation && base
                    ? style.keywordAnimation
                    : wordAnimation
                }
                motion={motion}
              />
            );
          })}
        </div>
      ))}
    </div>
  );

  const emojiNode = emoji ? (
    <span
      style={{
        display: "inline-block",
        fontSize: `${EMOJI_SCALE}em`,
        lineHeight: 1,
        position: "relative",
        zIndex: place === "top" ? 0 : 1,
        // Tucked partly behind the text, like a sticker.
        marginBottom: place === "top" ? "-0.25em" : undefined,
        marginTop: place === "bottom" ? "0.05em" : undefined,
        ...emojiMotion(emojiAnimation, since, Boolean(style.emojis?.animate)),
      }}
    >
      {emoji}
    </span>
  ) : null;

  const horizontal = place === "left" || place === "right";

  return (
    <div
      data-drag-target="subtitles"
      style={{
        position: "absolute",
        top: `${chunk.positionY ?? placement.y}%`,
        left: `${placement.x}%`,
        transform: "translate(-50%, -50%)",
        width: `${placement.width ?? DEFAULT_CAPTION_WIDTH}%`,
        zIndex: 10,
        display: "flex",
        justifyContent: "center",
        fontSize,
        lineHeight: LINE_HEIGHT,
      }}
    >
      <div
        style={merge(
          {
            display: "flex",
            flexDirection: horizontal ? "row" : "column",
            alignItems: "center",
            columnGap: "0.2em",
            maxWidth: "100%",
            transform:
              tilt || lift
                ? `translateY(${lift}em) rotate(${tilt}deg)`
                : undefined,
          },
          motion.style,
          idleMotion(idle, since),
          blur ? { filter: blur } : {},
        )}
      >
        {place === "top" || place === "left" ? emojiNode : null}
        {rowsBlock}
        {place === "bottom" || place === "right" ? emojiNode : null}
      </div>
    </div>
  );
}

function Word({
  word,
  index,
  text,
  firstLetter,
  totalLetters,
  isActive,
  time,
  sinceCaption,
  style,
  emphasize,
  fontSize,
  getFontFamily,
  wordAnimation,
  motion,
}: {
  word: WordTimestamp;
  index: number;
  text: string;
  firstLetter: number;
  totalLetters: number;
  isActive: boolean;
  time: number;
  sinceCaption: number;
  style: SubtitleStylePreset;
  emphasize: boolean;
  fontSize: number;
  getFontFamily: (font: string) => string;
  wordAnimation: WordAnimation | undefined;
  motion: CaptionMotion;
}) {
  const shadow = presetShadow(style);
  const strokeEm = presetStrokeEm(style, fontSize);

  const picked =
    word.keyword && style.keywordColors
      ? style.keywordColors[word.keyword - 1]
      : undefined;
  // A highlight the same color as the line box would make the word vanish.
  const keywordColor = sameColor(picked, style.backgroundColor) ? undefined : picked;
  const keywordBox = style.keywordStyle === "box" ? keywordColor : undefined;
  const baseColor = emphasize && style.emphasis ? style.emphasis.color : style.color;
  const restColor = keywordBox
    ? textOn(keywordBox, baseColor)
    : (keywordColor ?? baseColor);
  const color = (isActive ? style.highlightColor : undefined) ?? restColor;

  const boxColor = (isActive ? style.highlightBgColor : undefined) ?? keywordBox;
  const boxStyle: React.CSSProperties = boxColor
    ? {
        ...(boxColor.startsWith("linear-gradient")
          ? { backgroundImage: boxColor }
          : { backgroundColor: boxColor }),
        // The negative margin keeps words from shifting as the box moves.
        padding: `0.04em ${BOX_PADDING_X}em`,
        margin: `-0.04em -${BOX_PADDING_X}em`,
        borderRadius: `${style.backgroundRadius ?? 0.18}em`,
      }
    : {};

  const glowColor = plainColor(style.highlightColor) ? style.highlightColor : "#ffffff";
  const letterSpacing = (style.letterSpacing ?? 0) + (motion.letterSpacing ?? 0);
  const secondary = word.keyword && style.secondaryFontFamily;

  const textStyle: React.CSSProperties = {
    fontFamily: getFontFamily(secondary ? style.secondaryFontFamily! : style.fontFamily),
    fontWeight: secondary ? (style.secondaryFontWeight ?? style.fontWeight) : style.fontWeight,
    fontStyle: style.fontStyle,
    textTransform: style.textTransform,
    letterSpacing: letterSpacing ? `${letterSpacing.toFixed(5)}em` : undefined,
    whiteSpace: "pre",
    textShadow: shadow,
    // A box gives enough contrast; an outline on it looks muddy.
    ...(strokeEm && !boxColor
      ? {
          WebkitTextStroke: `${strokeEm.toFixed(5)}em ${style.strokeColor}`,
          paintOrder: "stroke fill",
        }
      : {}),
    ...fill(color),
    ...boxStyle,
    ...(word.effect
      ? wordEffectStyle(word.effect, time - word.start, glowColor, shadow)
      : {}),
  };

  const byLetter = motion.reveal !== undefined || motion.letterOpacity;
  const letters = (extra?: React.CSSProperties) =>
    byLetter
      ? Array.from(text).map((letter, i) => {
          const n = firstLetter + i;
          const shown =
            motion.reveal === undefined || n < Math.ceil(motion.reveal * totalLetters);
          const opacity = motion.letterOpacity?.(n, totalLetters) ?? 1;
          return (
            <span key={i} style={{ opacity: shown ? opacity : 0, ...extra }}>
              {letter}
            </span>
          );
        })
      : text;

  // The shaded fill sits on its own layer: text-shadow would paint over a
  // gradient clipped to the text.
  const shaded =
    style.fillGradient && plainColor(color) && !boxColor
      ? `linear-gradient(0deg, color-mix(in oklab, ${color} 80%, black) 10%, ${color} 30%, ${color} 100%)`
      : undefined;

  return (
    <span
      style={merge(
        { display: "inline-block" },
        wordMotion(wordAnimation, time - word.start, sinceCaption, index),
      )}
    >
      <span style={{ display: "inline-block", position: "relative", ...textStyle }}>
        {letters()}
        {shaded ? (
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              textShadow: "none",
              WebkitTextStroke: "0",
              ...fill(shaded),
            }}
          >
            {letters()}
          </span>
        ) : null}
      </span>
    </span>
  );
}

// Long enough for any of the sound files.
const SOUND_SECONDS = 3.5;

/** Plays each word's sound effect as the word is spoken. */
export function WordSounds({
  chunks,
  offset = 0,
  soundUrl,
}: {
  chunks: SubtitleChunk[];
  /** Seconds trimmed off the start of the source. */
  offset?: number;
  /** The file's URL in this app, from a path like "sfx/pop.mp3". */
  soundUrl: (path: string) => string;
}) {
  const { fps } = useVideoConfig();
  const cues = chunks.flatMap((chunk) =>
    chunk.hidden ? [] : chunk.words.filter((w) => w.sound && w.start >= offset),
  );
  return (
    <>
      {cues.map((word, i) => (
        <Sequence
          key={`${i}-${word.start}`}
          from={Math.round((word.start - offset) * fps)}
          durationInFrames={Math.round(SOUND_SECONDS * fps)}
          layout="none"
        >
          <Audio src={soundUrl(soundPath(word.sound!))} volume={soundVolume(word.sound!)} />
        </Sequence>
      ))}
    </>
  );
}
