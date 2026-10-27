"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  ClockClockwise,
  ClockCounterClockwise,
  MonitorPlay,
  Pause,
  Play,
  SpeakerHigh,
  SpeakerSlash,
} from "@phosphor-icons/react";
import { Slider } from "@/components/ui/slider";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { VideoComposition } from "@/components/subtitle-editor/video-composition";
import { formatClock } from "@/components/subtitle-editor/format";
import { IconButton } from "@/components/subtitle-editor/icon-button";
import { PreviewDragLayer } from "@/components/subtitle-editor/preview-drag-layer";
import type { SubtitleStylePreset } from "@/components/subtitle-editor/style-presets";
import type { CaptionPlacement } from "@/components/subtitle-editor/caption-style";
import type { TitleOverlayConfig } from "@/components/subtitle-editor/title-overlay";
import type { WatermarkOverlayConfig } from "@/components/subtitle-editor/tabs/edit-watermark-tab";
import {
  PreviewStyleControls,
  getCompositionDimensions,
  type PreviewStyleConfig,
} from "@/components/subtitle-editor/tabs/preview-style-tab";
import type { SubtitleChunk } from "@/remotion/types";
import {
  timelineDuration,
  type Timeline,
} from "@/components/subtitle-editor/caption-style";

const FPS = 30;
const FALLBACK_WIDTH = 1080;
const FALLBACK_HEIGHT = 1920;

interface VideoMetadata {
  durationInFrames: number;
  width: number;
  height: number;
}

type MetadataState =
  | { key: string; status: "ready"; metadata: VideoMetadata }
  | { key: string; status: "error" };

/** Reads duration and size from the video file itself. */
function useVideoMetadata(videoUrl: string | null, fallbackSeconds: number) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<MetadataState | null>(null);
  const key = `${videoUrl}|${attempt}`;

  useEffect(() => {
    if (!videoUrl) return;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";

    const onLoaded = () => {
      const seconds = Number.isFinite(video.duration)
        ? video.duration
        : fallbackSeconds;
      if (!seconds || seconds <= 0) {
        setState({ key, status: "error" });
        return;
      }
      setState({
        key,
        status: "ready",
        metadata: {
          durationInFrames: Math.max(1, Math.ceil(seconds * FPS)),
          width: video.videoWidth || FALLBACK_WIDTH,
          height: video.videoHeight || FALLBACK_HEIGHT,
        },
      });
    };
    const onError = () => setState({ key, status: "error" });

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("error", onError);
    video.src = videoUrl;

    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
      video.removeAttribute("src");
      video.load();
    };
  }, [videoUrl, fallbackSeconds, key]);

  const current = state?.key === key ? state : null;
  return {
    metadata: current?.status === "ready" ? current.metadata : null,
    failed: current?.status === "error",
    retry: () => setAttempt((n) => n + 1),
  };
}

function PlayerControls({
  playerRef,
  durationInFrames,
}: {
  playerRef: React.RefObject<PlayerRef | null>;
  durationInFrames: number;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [frame, setFrame] = useState(0);
  const lastFrame = Math.max(0, durationInFrames - 1);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onFrame = (event: { detail: { frame: number } }) =>
      setFrame(event.detail.frame);
    const onMute = (event: { detail: { isMuted: boolean } }) =>
      setIsMuted(event.detail.isMuted);

    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("seeked", onFrame);
    player.addEventListener("mutechange", onMute);
    return () => {
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("seeked", onFrame);
      player.removeEventListener("mutechange", onMute);
    };
  }, [playerRef]);

  const seek = (target: number) =>
    playerRef.current?.seekTo(Math.min(Math.max(0, target), lastFrame));

  return (
    <div className="space-y-2">
      <Slider
        aria-label="Playback position"
        value={[Math.min(frame, lastFrame)]}
        min={0}
        max={lastFrame}
        step={1}
        onValueChange={(next) => {
          const value = Array.isArray(next) ? next[0] : next;
          if (typeof value === "number") seek(value);
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <IconButton
            label={isPlaying ? "Pause" : "Play"}
            onClick={() => playerRef.current?.toggle()}
          >
            {isPlaying ? <Pause weight="fill" /> : <Play weight="fill" />}
          </IconButton>
          <IconButton label="Back 10 seconds" onClick={() => seek(frame - 10 * FPS)}>
            <ClockCounterClockwise />
          </IconButton>
          <IconButton label="Forward 10 seconds" onClick={() => seek(frame + 10 * FPS)}>
            <ClockClockwise />
          </IconButton>
          <span className="ml-1 text-xs tabular-nums text-muted-foreground">
            {formatClock(frame / FPS)} / {formatClock(durationInFrames / FPS)}
          </span>
        </div>
        <IconButton
          label={isMuted ? "Unmute" : "Mute"}
          onClick={() => {
            const player = playerRef.current;
            if (!player) return;
            if (player.isMuted()) player.unmute();
            else player.mute();
          }}
        >
          {isMuted ? <SpeakerSlash /> : <SpeakerHigh />}
        </IconButton>
      </div>
    </div>
  );
}

/** Jumps the preview to `seconds`; `preview` also plays a short moment. */
export type SeekFn = (seconds: number, options?: { preview?: boolean }) => void;

const PREVIEW_PLAY_MS = 1200;

interface VideoPreviewProps {
  videoUrl: string | null;
  /** Used when the file doesn't report its own duration. */
  durationSeconds: number;
  subtitleChunks: SubtitleChunk[];
  selectedPreset: SubtitleStylePreset;
  placement: CaptionPlacement;
  titleOverlay: TitleOverlayConfig;
  watermarkOverlay: WatermarkOverlayConfig;
  previewStyle: PreviewStyleConfig;
  timeline: Timeline;
  onPlacementChange: (values: CaptionPlacement) => void;
  onTitleOverlayChange: (config: TitleOverlayConfig) => void;
  onTimelineChange: (timeline: Timeline) => void;
  onPreviewStyleChange: (config: PreviewStyleConfig) => void;
  onUploadVideo: () => void;
  onTimeUpdate: (seconds: number) => void;
  /** Filled with a seek function while the player is ready. */
  seekRef: React.RefObject<SeekFn | null>;
}

/**
 * Live Remotion preview of the export. It fills its container, so give the
 * container a height.
 */
export function VideoPreview({
  videoUrl,
  durationSeconds,
  subtitleChunks,
  selectedPreset,
  placement,
  titleOverlay,
  watermarkOverlay,
  previewStyle,
  timeline,
  onPlacementChange,
  onTitleOverlayChange,
  onTimelineChange,
  onPreviewStyleChange,
  onUploadVideo,
  onTimeUpdate,
  seekRef,
}: VideoPreviewProps) {
  const [hovering, setHovering] = useState(false);
  const { metadata, failed, retry } = useVideoMetadata(
    videoUrl,
    durationSeconds,
  );
  const playerRef = useRef<PlayerRef>(null);
  const trimStartRef = useRef(0);
  useEffect(() => {
    trimStartRef.current = timeline.trim?.start ?? 0;
  }, [timeline.trim?.start]);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const playerReady = Boolean(metadata && videoUrl);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  useEffect(() => {
    if (!playerReady) return;
    const player = playerRef.current;
    if (!player) return;
    // The editor works in source-video time; a trim shifts the player's.
    const onFrame = (event: { detail: { frame: number } }) =>
      onTimeUpdateRef.current(event.detail.frame / FPS + trimStartRef.current);
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("seeked", onFrame);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("seeked", onFrame);
    };
  }, [playerReady]);

  useEffect(() => {
    if (!playerReady) return;
    let previewTimer: ReturnType<typeof setTimeout> | undefined;
    seekRef.current = (seconds, options) => {
      const player = playerRef.current;
      if (!player) return;
      clearTimeout(previewTimer);
      player.seekTo(Math.max(0, Math.round((seconds - trimStartRef.current) * FPS)));
      if (!options?.preview) return;
      // Play a short moment, e.g. to show a word animation just picked.
      player.play();
      previewTimer = setTimeout(() => player.pause(), PREVIEW_PLAY_MS);
    };
    return () => {
      clearTimeout(previewTimer);
      seekRef.current = null;
    };
  }, [seekRef, playerReady]);

  const inputProps = useMemo(
    () => ({
      videoUrl: videoUrl ?? "",
      subtitleChunks,
      selectedPreset,
      placement,
      titleOverlay,
      watermarkOverlay,
      previewStyle,
      timeline,
    }),
    [
      timeline,
      videoUrl,
      subtitleChunks,
      selectedPreset,
      placement,
      titleOverlay,
      watermarkOverlay,
      previewStyle,
    ],
  );

  const renderPlayerError = useCallback(
    () => (
      <div className="flex size-full items-center justify-center bg-muted p-4 text-center text-xs text-muted-foreground">
        Couldn&apos;t play this video.
      </div>
    ),
    [],
  );

  if (!videoUrl) {
    return (
      <EmptyState
        icon={MonitorPlay}
        title="No video"
        description="This project has no video. Upload one to start a new project."
        action={{ label: "Upload video", onClick: onUploadVideo }}
        className="h-full"
      />
    );
  }

  if (failed) {
    return (
      <ErrorState
        title="Couldn't load the video"
        description="The file may have been removed or your connection dropped."
        onRetry={retry}
        className="h-full"
      />
    );
  }

  if (!metadata) {
    return <LoadingState label="Loading video" className="h-full" />;
  }

  // A trim shortens the video and an outro adds to it.
  const durationInFrames = Math.max(
    1,
    Math.round(timelineDuration(timeline, metadata.durationInFrames / FPS) * FPS),
  );
  const { width, height } = getCompositionDimensions(
    previewStyle,
    metadata.width,
    metadata.height,
  );

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Size container: the player keeps its aspect ratio inside it. */}
      <div className="relative min-h-0 flex-1 [container-type:size]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="relative overflow-hidden rounded-lg bg-media"
            style={{
              width: `min(100cqw, 100cqh * ${width} / ${height})`,
              aspectRatio: `${width} / ${height}`,
            }}
            onPointerEnter={() => setHovering(true)}
            onPointerLeave={() => setHovering(false)}
          >
            <Player
              ref={playerRef}
              component={VideoComposition}
              inputProps={inputProps}
              durationInFrames={durationInFrames}
              compositionWidth={width}
              compositionHeight={height}
              fps={FPS}
              style={{ width: "100%", height: "100%" }}
              errorFallback={renderPlayerError}
            />
            <PreviewDragLayer
              active={hovering}
              compositionWidth={width}
              hasSubtitles={subtitleChunks.length > 0}
              placement={placement}
              onPlacementChange={onPlacementChange}
              titleOverlay={titleOverlay}
              onTitleOverlayChange={onTitleOverlayChange}
              timeline={timeline}
              onTimelineChange={onTimelineChange}
            />
          </div>
        </div>
      </div>
      <PreviewStyleControls
        config={previewStyle}
        onChange={onPreviewStyleChange}
      />
      <PlayerControls
        playerRef={playerRef}
        durationInFrames={durationInFrames}
      />
    </div>
  );
}
