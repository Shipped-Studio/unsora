"use client";

import React from "react";
import {
  AbsoluteFill,
  Img,
  Video,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { SubtitleChunk, WordEffect } from "@/remotion/types";
import type { SubtitleStylePreset } from "./style-presets";
import type { SizePositionValues } from "./tabs/style-subtitles-tab";
import {
  TitleOverlay,
  normalizeTitleOverlay,
  type TitleOverlayConfig,
} from "./title-overlay";
import type {
  WatermarkOverlayConfig,
  WatermarkPosition,
} from "./tabs/edit-watermark-tab";
import type { PreviewStyleConfig } from "./tabs/preview-style-tab";
import { getFontFamily } from "@/remotion/fonts";

interface VideoCompositionProps {
  videoUrl: string;
  subtitleChunks?: SubtitleChunk[];
  selectedPreset?: SubtitleStylePreset | null;
  sizePosition?: SizePositionValues | null;
  titleOverlay?: TitleOverlayConfig | null;
  watermarkOverlay?: WatermarkOverlayConfig | null;
  previewStyle?: PreviewStyleConfig | null;
}

export const VideoComposition: React.FC<VideoCompositionProps> = ({
  videoUrl,
  subtitleChunks = [],
  selectedPreset,
  sizePosition,
  titleOverlay,
  watermarkOverlay,
  previewStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const currentTime = frame / fps;

  const activeChunk = subtitleChunks.find(
    (c) => currentTime >= c.start && currentTime <= c.end,
  );

  // Highlight by index (not by text) so repeated words don't all light up,
  // and keep the last started word active through gaps between timestamps.
  const chunkWords = activeChunk?.words ?? [];
  let activeWordIndex = -1;
  for (let i = 0; i < chunkWords.length; i++) {
    if (currentTime >= chunkWords[i].start) activeWordIndex = i;
    else break;
  }

  const videoFit = previewStyle?.videoFit ?? "contain";
  const backgroundColor = previewStyle?.backgroundColor || "#000";

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {videoFit === "blur" && (
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <Video
            src={videoUrl}
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(40px) brightness(0.7)",
              transform: "scale(1.15)",
            }}
          />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <Video
          src={videoUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: videoFit === "cover" ? "cover" : "contain",
          }}
        />
      </AbsoluteFill>

      {activeChunk && !activeChunk.hidden && selectedPreset && (
        <SubtitleOverlay
          chunk={activeChunk}
          activeWordIndex={activeWordIndex}
          time={currentTime}
          preset={selectedPreset}
          sizePosition={sizePosition ?? undefined}
        />
      )}

      {titleOverlay && (
        <TitleOverlay
          config={normalizeTitleOverlay(titleOverlay, { width, height })}
          time={currentTime}
          frameWidth={width}
          getFontFamily={getFontFamily}
        />
      )}

      {watermarkOverlay?.enabled &&
        (watermarkOverlay.text || watermarkOverlay.imageUrl) && (
          <WatermarkOverlay config={watermarkOverlay} />
        )}
    </AbsoluteFill>
  );
};

const UPPERCASE_TRACKING = 0.04;
const BOX_PADDING_X = 0.16;

// Word effect timings, in seconds from when the word is spoken.
const EFFECT_SECONDS = 0.4;
const GLOW_SECONDS = 0.9;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const lerp = (from: number, to: number, p: number) => from + (to - from) * p;
const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;
const easeOutBack = (p: number) => {
  const c1 = 1.70158;
  return 1 + (c1 + 1) * (p - 1) ** 3 + c1 * (p - 1) ** 2;
};

/**
 * A word's effect as a function of time, so every exported frame matches the
 * preview. `since` is seconds since the word was spoken.
 */
function wordEffectStyle(
  effect: WordEffect,
  since: number,
  glowColor: string,
  baseShadow: string | undefined,
): React.CSSProperties {
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

function SubtitleOverlay({
  chunk,
  activeWordIndex,
  time,
  preset,
  sizePosition,
}: {
  chunk: SubtitleChunk;
  activeWordIndex: number;
  /** Seconds into the video, for word effects. */
  time: number;
  preset: SubtitleStylePreset;
  sizePosition?: SizePositionValues;
}) {
  const { width: compWidth } = useVideoConfig();

  const words = chunk.words?.length
    ? chunk.words.map((w) => ({
        text: w.word,
        lineBreak: Boolean(w.lineBreak),
        start: w.start as number | undefined,
        effect: w.effect,
      }))
    : chunk.text.split(" ").map((text) => ({
        text,
        lineBreak: false,
        start: undefined,
        effect: undefined,
      }));

  const glowColor =
    preset.highlightColor && !preset.highlightColor.startsWith("linear-gradient")
      ? preset.highlightColor
      : "#ffffff";

  const fontSize = sizePosition?.fontSize ?? preset.fontSize;
  const overlayWidth = sizePosition?.width ?? Math.round(compWidth * 0.85);
  const xOffset = sizePosition?.xAxis ?? 0;
  const yOffset = sizePosition?.yAxis ?? 0;

  const uppercase = preset.textTransform === "uppercase";
  const baseTextStyle: React.CSSProperties = {
    fontFamily: getFontFamily(preset.fontFamily),
    fontWeight: preset.fontWeight,
    fontStyle: preset.fontStyle,
    textTransform: preset.textTransform,
    letterSpacing: uppercase ? `${UPPERCASE_TRACKING}em` : undefined,
    textShadow: preset.shadow,
    lineHeight: 1.3,
  };

  const strokeStyle: React.CSSProperties =
    preset.strokeColor && preset.strokeWidth
      ? {
          WebkitTextStroke: `${preset.strokeWidth}px ${preset.strokeColor}`,
          paintOrder: "stroke fill",
        }
      : {};

  const containerStyle: React.CSSProperties = preset.backgroundColor
    ? {
        backgroundColor: preset.backgroundColor,
        padding: `${preset.backgroundPadding ?? 6}px ${(preset.backgroundPadding ?? 6) * 2}px`,
        borderRadius: 8,
      }
    : {};

  return (
    <div
      data-drag-target="subtitles"
      style={{
        position: "absolute",
        bottom: `${yOffset}%`,
        left: `${50 + xOffset}%`,
        transform: "translateX(-50%)",
        width: overlayWidth,
        maxWidth: "90%",
        zIndex: 10,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignContent: "center",
        // Sized from the text so spacing scales with it.
        fontSize,
        columnGap: "0.32em",
        rowGap: "0.08em",
        ...containerStyle,
      }}
    >
      {words.map((word, i) => {
        const isActive = i === activeWordIndex;
        const wordColor = isActive
          ? preset.highlightColor || preset.color
          : preset.color;

        const colorStyle: React.CSSProperties = wordColor.startsWith(
          "linear-gradient",
        )
          ? {
              backgroundImage: wordColor,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }
          : { color: wordColor };

        const boxed = isActive && Boolean(preset.highlightBgColor);
        // The negative margin keeps words from shifting as the box moves; it
        // stays inside the gap. Tracking adds space after the last letter.
        const highlightBgStyle: React.CSSProperties =
          boxed && preset.highlightBgColor
            ? {
                ...(preset.highlightBgColor.startsWith("linear-gradient")
                  ? { backgroundImage: preset.highlightBgColor }
                  : { backgroundColor: preset.highlightBgColor }),
                padding: `0.04em ${BOX_PADDING_X - (uppercase ? UPPERCASE_TRACKING : 0)}em 0.04em ${BOX_PADDING_X}em`,
                margin: `-0.04em -${BOX_PADDING_X}em`,
                borderRadius: "0.18em",
              }
            : {};

        return (
          <React.Fragment key={`${i}-${word.text}`}>
            <span
              style={{
                ...baseTextStyle,
                // The box gives enough contrast; an outline on it looks muddy.
                ...(boxed ? {} : strokeStyle),
                ...colorStyle,
                ...highlightBgStyle,
                fontSize,
                ...(word.effect && word.start !== undefined
                  ? wordEffectStyle(
                      word.effect,
                      time - word.start,
                      glowColor,
                      preset.shadow,
                    )
                  : {}),
                transition: "color 0.08s ease",
              }}
            >
              {word.text}
            </span>
            {/* A full-width empty item forces the next word onto a new row. */}
            {word.lineBreak ? (
              <span style={{ flexBasis: "100%", height: 0 }} />
            ) : null}
          </React.Fragment>
        );
      })}
      {chunk.emoji ? (
        <span
          style={{
            flexBasis: "100%",
            textAlign: "center",
            fontSize: "1.1em",
            lineHeight: 1.2,
          }}
        >
          {chunk.emoji}
        </span>
      ) : null}
    </div>
  );
}

function getPositionStyle(position: WatermarkPosition): React.CSSProperties {
  const map: Record<WatermarkPosition, React.CSSProperties> = {
    "top-left": { top: "5%", left: "5%" },
    "top-center": { top: "5%", left: "50%", transform: "translateX(-50%)" },
    "top-right": { top: "5%", right: "5%" },
    "center-left": { top: "50%", left: "5%", transform: "translateY(-50%)" },
    center: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
    "center-right": { top: "50%", right: "5%", transform: "translateY(-50%)" },
    "bottom-left": { bottom: "5%", left: "5%" },
    "bottom-center": {
      bottom: "5%",
      left: "50%",
      transform: "translateX(-50%)",
    },
    "bottom-right": { bottom: "5%", right: "5%" },
  };
  return map[position] ?? map["bottom-right"];
}

function WatermarkOverlay({ config }: { config: WatermarkOverlayConfig }) {
  const positionStyle = getPositionStyle(config.position);

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 30,
        opacity: config.opacity / 100,
        pointerEvents: "none",
        ...positionStyle,
      }}
    >
      {config.type === "text" && config.text && (
        <span
          style={{
            fontFamily: getFontFamily("inter"),
            fontSize: config.fontSize,
            color: config.color,
            fontWeight: 600,
            whiteSpace: "nowrap",
            textShadow: "0 1px 4px rgba(0,0,0,0.4)",
          }}
        >
          {config.text}
        </span>
      )}
      {config.type === "image" && config.imageUrl && (
        <Img
          src={config.imageUrl}
          style={{
            maxHeight: 80,
            maxWidth: 200,
            objectFit: "contain",
          }}
        />
      )}
    </div>
  );
}
