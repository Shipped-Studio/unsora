"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Player } from "@remotion/player";
import type { PlayerRef } from "@remotion/player";
import { Button } from "@/components/ui/button";
import {
  MonitorPlay,
  ArrowsClockwise,
  Play,
  Pause,
  SpeakerHigh,
  SpeakerSlash,
  ClockCounterClockwise,
  ClockClockwise,
} from "@phosphor-icons/react";
import { VideoComposition } from "./video-composition";
import { getCdnUrl } from "@/lib/video-utils";
import type { SubtitleChunk } from "@/remotion/types";
import type { SubtitleStylePreset } from "./style-presets";
import type { SizePositionValues } from "./tabs/style-subtitles-tab";
import type { TitleOverlayConfig } from "./tabs/edit-title-tab";
import type { WatermarkOverlayConfig } from "./tabs/edit-watermark-tab";
import {
  getCompositionDimensions,
  type PreviewStyleConfig,
} from "./tabs/preview-style-tab";

const FPS = 30;
const FALLBACK_WIDTH = 1080;
const FALLBACK_HEIGHT = 1920;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface VideoMetadata {
  durationInFrames: number;
  sourceWidth: number;
  sourceHeight: number;
}

function useVideoMetadata(videoUrl: string | null) {
  const [metadataMap, setMetadataMap] = useState<
    Record<string, VideoMetadata>
  >({});

  useEffect(() => {
    if (!videoUrl) return;
    if (metadataMap[videoUrl]) return;

    let cancelled = false;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";

    const handleLoaded = () => {
      if (cancelled) return;
      setMetadataMap((prev) => ({
        ...prev,
        [videoUrl]: {
          durationInFrames: Math.ceil(video.duration * FPS),
          sourceWidth: video.videoWidth || FALLBACK_WIDTH,
          sourceHeight: video.videoHeight || FALLBACK_HEIGHT,
        },
      }));
      video.remove();
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    video.src = videoUrl;

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.remove();
    };
  }, [videoUrl, metadataMap]);

  if (!videoUrl) return null;
  return metadataMap[videoUrl] ?? null;
}

interface PlayerControlsProps {
  playerRef: React.RefObject<PlayerRef | null>;
  durationInFrames: number;
  fps: number;
}

function PlayerControls({
  playerRef,
  durationInFrames,
  fps,
}: PlayerControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const seekingRef = useRef(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const totalDuration = durationInFrames / fps;
  const currentTime = currentFrame / fps;
  const progress = durationInFrames > 0 ? currentFrame / durationInFrames : 0;

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onFrame = (e: { detail: { frame: number } }) =>
      setCurrentFrame(e.detail.frame);

    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("frameupdate", onFrame);

    return () => {
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("frameupdate", onFrame);
    };
  }, [playerRef]);

  const togglePlay = useCallback(() => {
    playerRef.current?.toggle();
  }, [playerRef]);

  const toggleMute = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isMuted()) {
      player.unmute();
      setIsMuted(false);
    } else {
      player.mute();
      setIsMuted(true);
    }
  }, [playerRef]);

  const skip = useCallback(
    (seconds: number) => {
      const player = playerRef.current;
      if (!player) return;
      const target = Math.min(
        Math.max(0, currentFrame + seconds * fps),
        durationInFrames - 1,
      );
      player.seekTo(target);
    },
    [playerRef, currentFrame, fps, durationInFrames],
  );

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const bar = progressRef.current;
      const player = playerRef.current;
      if (!bar || !player) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.min(
        Math.max((clientX - rect.left) / rect.width, 0),
        1,
      );
      player.seekTo(Math.round(ratio * (durationInFrames - 1)));
    },
    [playerRef, durationInFrames],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      seekingRef.current = true;
      playerRef.current?.pause();
      seekFromEvent(e.clientX);

      const onMove = (ev: PointerEvent) => seekFromEvent(ev.clientX);
      const onUp = () => {
        seekingRef.current = false;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [playerRef, seekFromEvent],
  );

  return (
    <div className="space-y-2 px-1">
      {/* Progress bar */}
      <div
        ref={progressRef}
        className="group relative h-1.5 cursor-pointer rounded-full bg-muted"
        onPointerDown={onPointerDown}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${progress * 100}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 size-3 rounded-full bg-primary opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
          style={{ left: `calc(${progress * 100}% - 6px)` }}
        />
      </div>

      {/* Time + buttons row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={togglePlay}
            className="flex size-8 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted"
          >
            {isPlaying ? (
              <Pause className="size-4" weight="fill" />
            ) : (
              <Play className="size-4" weight="fill" />
            )}
          </button>
          <button
            onClick={() => skip(-10)}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ClockCounterClockwise className="size-4" />
          </button>
          <button
            onClick={() => skip(10)}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ClockClockwise className="size-4" />
          </button>
          <span className="ml-1 text-xs tabular-nums text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
        </div>
        <button
          onClick={toggleMute}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {isMuted ? (
            <SpeakerSlash className="size-4" />
          ) : (
            <SpeakerHigh className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}

interface VideoPreviewProps {
  videoUrl: string | null;
  subtitleChunks?: SubtitleChunk[];
  selectedPreset?: SubtitleStylePreset;
  sizePosition?: SizePositionValues;
  titleOverlay?: TitleOverlayConfig;
  watermarkOverlay?: WatermarkOverlayConfig;
  previewStyle?: PreviewStyleConfig;
  onOpenMediaSelector: () => void;
  onTimeUpdate?: (timeInSeconds: number) => void;
  seekRef?: React.MutableRefObject<((timeInSeconds: number) => void) | null>;
}

export function VideoPreview({
  videoUrl,
  subtitleChunks = [],
  selectedPreset,
  sizePosition,
  titleOverlay,
  watermarkOverlay,
  previewStyle,
  onOpenMediaSelector,
  onTimeUpdate,
  seekRef,
}: VideoPreviewProps) {
  const metadata = useVideoMetadata(videoUrl);
  const playerRef = useRef<PlayerRef>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  const playerReady = !!metadata && !!videoUrl;

  useEffect(() => {
    if (!playerReady) return;
    const player = playerRef.current;
    if (!player) return;
    const handler = (e: { detail: { frame: number } }) => {
      onTimeUpdateRef.current?.(e.detail.frame / FPS);
    };
    player.addEventListener("frameupdate", handler);
    return () => player.removeEventListener("frameupdate", handler);
  }, [playerReady]);

  useEffect(() => {
    if (!seekRef) return;
    if (!playerReady) {
      seekRef.current = null;
      return;
    }
    seekRef.current = (timeInSeconds: number) => {
      playerRef.current?.seekTo(Math.round(timeInSeconds * FPS));
    };
    return () => {
      seekRef.current = null;
    };
  }, [seekRef, playerReady]);

  const cdnVideoUrl = useMemo(
    () => (videoUrl ? getCdnUrl(videoUrl) : ""),
    [videoUrl],
  );

  const inputProps = useMemo(
    () => ({
      videoUrl: cdnVideoUrl,
      subtitleChunks,
      selectedPreset: selectedPreset ?? null,
      sizePosition: sizePosition ?? null,
      titleOverlay: titleOverlay ?? null,
      watermarkOverlay: watermarkOverlay ?? null,
      previewStyle: previewStyle ?? null,
    }),
    [
      cdnVideoUrl,
      subtitleChunks,
      selectedPreset,
      sizePosition,
      titleOverlay,
      watermarkOverlay,
      previewStyle,
    ],
  );

  const compDimensions = useMemo(() => {
    if (!metadata) return null;
    return getCompositionDimensions(
      previewStyle,
      metadata.sourceWidth,
      metadata.sourceHeight,
    );
  }, [metadata, previewStyle]);

  if (!videoUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <MonitorPlay
          className="size-12 text-muted-foreground/30"
          weight="thin"
        />
        <p className="max-w-[280px] text-sm text-muted-foreground">
          Upload your video and generate your subtitles to begin configuring
          them
        </p>
        <Button variant="default" onClick={onOpenMediaSelector}>
          Open Media Selector
        </Button>
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <ArrowsClockwise className="size-6 animate-spin text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Loading video...</p>
      </div>
    );
  }

  const isLandscape =
    !!compDimensions && compDimensions.width > compDimensions.height;

  return (
    <div
      className={`mx-auto flex h-full w-full flex-col gap-4 ${
        isLandscape ? "max-w-[560px]" : "max-w-[360px]"
      }`}
    >
      <div className="flex items-center justify-center overflow-hidden">
        <Player
          ref={playerRef}
          component={VideoComposition}
          inputProps={inputProps}
          durationInFrames={metadata.durationInFrames}
          compositionWidth={compDimensions?.width ?? FALLBACK_WIDTH}
          compositionHeight={compDimensions?.height ?? FALLBACK_HEIGHT}
          fps={FPS}
          style={{
            width: "100%",
            maxHeight: "100%",
            borderRadius: "0.75rem",
            overflow: "hidden",
          }}
          autoPlay={false}
          loop={false}
        />
      </div>

      <div>
        <PlayerControls
          playerRef={playerRef}
          durationInFrames={metadata.durationInFrames}
          fps={FPS}
        />
      </div>
    </div>
  );
}
