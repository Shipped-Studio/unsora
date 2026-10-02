import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type {
  CompositionProps,
  SubtitleChunk,
  SubtitleStylePreset,
  SizePositionValues,
  TitleOverlayConfig,
  WatermarkOverlayConfig,
  WatermarkPosition,
} from "./types";
import { getFontFamily } from "./fonts";

export const SubtitleComposition: React.FC<CompositionProps> = ({
  videoUrl,
  subtitleChunks = [] as SubtitleChunk[],
  settings = {} as CompositionProps["settings"],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const { preset, sizePosition, titleOverlay, watermarkOverlay, previewStyle } =
    settings;

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
          <OffthreadVideo
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
        <OffthreadVideo
          src={videoUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: videoFit === "cover" ? "cover" : "contain",
          }}
        />
      </AbsoluteFill>

      {activeChunk && preset && (
        <SubtitleOverlay
          chunk={activeChunk}
          activeWordIndex={activeWordIndex}
          preset={preset}
          sizePosition={sizePosition}
        />
      )}

      {titleOverlay?.enabled && titleOverlay.text && (
        <TitleOverlay config={titleOverlay} />
      )}

      {watermarkOverlay?.enabled &&
        (watermarkOverlay.text || watermarkOverlay.imageUrl) && (
          <WatermarkOverlay config={watermarkOverlay} />
        )}
    </AbsoluteFill>
  );
};

function SubtitleOverlay({
  chunk,
  activeWordIndex,
  preset,
  sizePosition,
}: {
  chunk: SubtitleChunk;
  activeWordIndex: number;
  preset: SubtitleStylePreset;
  sizePosition?: SizePositionValues;
}) {
  const { width: compWidth } = useVideoConfig();

  const words = chunk.words?.length
    ? chunk.words.map((w) => w.word)
    : chunk.text.split(" ");

  const fontSize = sizePosition?.fontSize ?? preset.fontSize;
  const overlayWidth = sizePosition?.width ?? Math.round(compWidth * 0.85);
  const xOffset = sizePosition?.xAxis ?? 0;
  const yOffset = sizePosition?.yAxis ?? 0;

  const baseTextStyle: React.CSSProperties = {
    fontFamily: getFontFamily(preset.fontFamily),
    fontWeight: preset.fontWeight,
    fontStyle: preset.fontStyle,
    textTransform: preset.textTransform,
    letterSpacing: preset.textTransform === "uppercase" ? "0.04em" : undefined,
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
        gap: "0.5em",
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

        const highlightBgStyle: React.CSSProperties =
          isActive && preset.highlightBgColor
            ? {
                ...(preset.highlightBgColor.startsWith("linear-gradient")
                  ? { backgroundImage: preset.highlightBgColor }
                  : { backgroundColor: preset.highlightBgColor }),
                padding: "0.06em 0.24em",
                margin: "-0.06em -0.24em",
                borderRadius: "0.18em",
              }
            : {};

        return (
          <span
            key={`${i}-${word}`}
            style={{
              ...baseTextStyle,
              ...strokeStyle,
              ...colorStyle,
              ...highlightBgStyle,
              fontSize,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

function TitleOverlay({ config }: { config: TitleOverlayConfig }) {
  return (
    <div
      style={{
        position: "absolute",
        top: `${8 + config.yAxis}%`,
        left: `${50 + config.xAxis}%`,
        transform: "translateX(-50%)",
        width: `${config.width ?? 90}%`,
        zIndex: 20,
        fontFamily: getFontFamily("inter"),
        fontSize: config.fontSize,
        fontWeight: config.fontWeight,
        color: config.color,
        textAlign: "center",
        whiteSpace: "pre-wrap",
        textShadow: "0 2px 8px rgba(0,0,0,0.5)",
        lineHeight: 1.2,
      }}
    >
      {config.text}
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
