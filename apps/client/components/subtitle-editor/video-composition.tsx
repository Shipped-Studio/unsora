"use client";

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Img,
  Video,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { SubtitleChunk } from "@/remotion/types";
import { CaptionsLayer, WordSounds } from "./caption-overlay";
import { DEFAULT_CAPTION_WIDTH, type Timeline } from "./caption-style";
import {
  BrollLayer,
  OutroCard,
  TimelineSounds,
  TransitionOverlay,
  WidgetsLayer,
  activeClip,
  activeMotion,
  arollStyle,
} from "./timeline-layer";


const DEFAULT_PLACEMENT = { size: 22, x: 50, y: 75, width: DEFAULT_CAPTION_WIDTH };
import { zoomEvents, zoomTransform } from "./caption-animations";
import type { SubtitleStylePreset } from "./style-presets";
import type { CaptionPlacement } from "./caption-style";
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
  placement?: CaptionPlacement | null;
  titleOverlay?: TitleOverlayConfig | null;
  watermarkOverlay?: WatermarkOverlayConfig | null;
  previewStyle?: PreviewStyleConfig | null;
  timeline?: Timeline;
}

export const VideoComposition: React.FC<VideoCompositionProps> = ({
  videoUrl,
  subtitleChunks = [],
  selectedPreset,
  placement,
  titleOverlay,
  watermarkOverlay,
  previewStyle,
  timeline,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  // Captions, B-rolls and sounds are timed on the source video; a trim
  // moves the output's start into it.
  const trimStart = timeline?.trim?.start ?? 0;
  const outputTime = frame / fps;
  const currentTime = outputTime + trimStart;
  const outroStart = timeline?.outro
    ? durationInFrames / fps - timeline.outro.duration
    : Infinity;

  const videoFit = previewStyle?.videoFit ?? "contain";
  const backgroundColor = previewStyle?.backgroundColor || "#000";
  const zoom = previewStyle?.zoom;
  const sceneZooms = previewStyle?.zooms;
  // AI Auto Zooms set a zoom per scene; otherwise the Zoom setting zooms at
  // key moments.
  const zooms = useMemo(
    () => (sceneZooms?.length ? sceneZooms : zoomEvents(subtitleChunks, zoom)),
    [sceneZooms, zoom, subtitleChunks],
  );
  const videoTransform = zoomTransform(currentTime, zooms);
  const clip = activeClip(timeline, currentTime);
  // A motion transition moves whatever comes in at its cut: the B-roll that
  // starts there, or the speaker when a B-roll ends.
  const motion = activeMotion(timeline?.transitions, currentTime, fps);
  const brollEnters = Boolean(motion && clip && Math.abs(clip.start - motion.at) < 0.05);
  const trimBefore = Math.round(trimStart * fps);

  return (
    <AbsoluteFill style={{ backgroundColor, overflow: "hidden" }}>
      <AbsoluteFill>
        <div
          style={{
            ...arollStyle(clip),
            ...(motion && !brollEnters ? motion.style : {}),
          }}
        >
          <AbsoluteFill style={{ transform: videoTransform }}>
            {videoFit === "blur" && (
              <AbsoluteFill style={{ overflow: "hidden" }}>
                <Video
                  src={videoUrl}
                  muted
                  trimBefore={trimBefore}
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
                trimBefore={trimBefore}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: videoFit === "cover" || clip ? "cover" : "contain",
                }}
              />
            </AbsoluteFill>
          </AbsoluteFill>
        </div>
        <BrollLayer
          timeline={timeline}
          time={currentTime}
          offset={trimStart}
          motion={brollEnters ? motion?.style : undefined}
          VideoComponent={Video}
        />
      </AbsoluteFill>

      <TransitionOverlay transitions={timeline?.transitions} time={currentTime} />

      <WidgetsLayer
        timeline={timeline}
        time={currentTime}
        frameWidth={width}
        fontFamily={getFontFamily("inter")}
      />

      <WordSounds chunks={subtitleChunks} offset={trimStart} soundUrl={(path) => `/${path}`} />
      <TimelineSounds timeline={timeline} offset={trimStart} soundUrl={(path) => `/${path}`} />

      {selectedPreset && (
        <CaptionsLayer
          chunks={subtitleChunks}
          time={currentTime}
          preset={selectedPreset}
          placement={placement ?? DEFAULT_PLACEMENT}
          frameWidth={width}
          getFontFamily={getFontFamily}
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

      {timeline?.outro && outputTime >= outroStart ? (
        <OutroCard
          outro={timeline.outro}
          since={outputTime - outroStart}
          frameWidth={width}
          fontFamily={getFontFamily("inter")}
        />
      ) : null}
    </AbsoluteFill>
  );
};

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
