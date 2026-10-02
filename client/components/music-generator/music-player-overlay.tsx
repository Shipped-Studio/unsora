"use client";

import { useCallback, useRef, useState } from "react";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
  MusicNotes,
  CornersOut,
  CornersIn,
  Minus,
  ArrowClockwise,
} from "@phosphor-icons/react";
import { useMusicPlayer } from "@/contexts/music-player-context";
import { SyncedLyrics } from "@/components/music-generator/synced-lyrics";
import { formatPlaybackTime } from "@/lib/music-lyrics";
import { useMusicPlayerDockHeight } from "@/hooks/use-music-player-dock-height";
import {
  useCollapseExpandedOnMobile,
  usePrefersReducedMotion,
} from "@/hooks/use-music-player-responsive";
import { MUSIC_PLAYER_SHELL_CLASS } from "@/lib/layout-classes";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function MusicPlayerOverlay() {
  const shellRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    playerView,
    playbackError,
    toggle,
    seek,
    stop,
    retryPlay,
    setPlayerView,
    minimizePlayer,
  } = useMusicPlayer();

  const isMinimized = playerView === "minimized";
  const isExpanded = playerView === "expanded";

  useMusicPlayerDockHeight(shellRef, Boolean(currentTrack));
  usePrefersReducedMotion(shellRef);
  useCollapseExpandedOnMobile(isExpanded, () => setPlayerView("mini"));

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const seekFromClientX = useCallback(
    (clientX: number, target: HTMLDivElement) => {
      if (!duration) return;
      const rect = target.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.min(
        1,
        Math.max(0, (clientX - rect.left) / rect.width),
      );
      seek(ratio * duration);
    },
    [duration, seek],
  );

  const handleSeekPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    seekFromClientX(event.clientX, event.currentTarget);
  };

  const handleSeekPointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!isDragging) return;
    seekFromClientX(event.clientX, event.currentTarget);
  };

  const handleSeekPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
  };

  if (!currentTrack) return null;

  return (
    <div
      ref={shellRef}
      className={cn(
        MUSIC_PLAYER_SHELL_CLASS,
        "transition-[width,max-height,transform,opacity] duration-300 ease-out",
        isMinimized ? "w-auto" : "w-auto max-sm:w-auto",
      )}
    >
      {isMinimized ? (
        <button
          type="button"
          onClick={() => setPlayerView("mini")}
          className={cn(
            "flex size-[52px] items-center justify-center rounded-full border border-border bg-background/95 text-primary shadow-lg backdrop-blur-xl transition-transform hover:scale-105 active:scale-95",
            isPlaying && "ring-2 ring-primary/30",
          )}
          aria-label="Open music player"
        >
          {isBuffering ? (
            <Spinner className="size-4" />
          ) : isPlaying ? (
            <Pause className="size-4" weight="fill" />
          ) : (
            <MusicNotes className="size-5" weight="duotone" />
          )}
        </button>
      ) : (
        <div
          className={cn(
            "overflow-hidden rounded-2xl border border-border bg-background/95 shadow-2xl shadow-black/10 backdrop-blur-xl",
            "max-sm:w-[calc(100vw-3.5rem-1.5rem)]",
            isExpanded
              ? "max-h-[min(45dvh,320px)] sm:max-h-[min(50vh,320px)]"
              : "max-h-none",
          )}
        >
          {isExpanded && currentTrack.lyrics && (
            <div className="border-b px-3 pb-2 pt-3">
              <SyncedLyrics
                lyrics={currentTrack.lyrics}
                currentTime={currentTime}
                duration={duration}
                isActive={isPlaying || currentTime > 0}
                variant="overlay"
                className="max-h-[min(28dvh,160px)] sm:max-h-40"
              />
            </div>
          )}

          <div className="relative px-3 py-2.5 sm:px-3.5">
            {playbackError && (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-2">
                <p className="text-[11px] leading-snug text-destructive/90">
                  {playbackError}
                </p>
                <button
                  type="button"
                  onClick={retryPlay}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <ArrowClockwise className="size-3" />
                  Retry
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 sm:gap-2.5">
              <button
                type="button"
                onClick={toggle}
                disabled={isBuffering && !isPlaying}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:size-10"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isBuffering ? (
                  <Spinner className="size-4" />
                ) : isPlaying ? (
                  <Pause className="size-4" weight="fill" />
                ) : (
                  <Play className="size-4 translate-x-px" weight="fill" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {currentTrack.title || "Untitled song"}
                </p>
                <p className="truncate text-[10px] text-muted-foreground sm:text-[11px]">
                  {currentTrack.subtitle || "Generated song"}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                {currentTrack.lyrics &&
                  (isExpanded ? (
                    <button
                      type="button"
                      onClick={() => setPlayerView("mini")}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground max-sm:hidden"
                      aria-label="Collapse player"
                    >
                      <CornersIn className="size-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPlayerView("expanded")}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground max-sm:hidden"
                      aria-label="Expand player"
                    >
                      <CornersOut className="size-3.5" />
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={minimizePlayer}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Minimize player"
                >
                  <Minus className="size-3.5" weight="bold" />
                </button>
                <button
                  type="button"
                  onClick={stop}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close player"
                >
                  <X className="size-3.5" weight="bold" />
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="mt-2 hidden items-center justify-center gap-1.5 sm:flex">
                <button
                  type="button"
                  onClick={() => seek(Math.max(0, currentTime - 10))}
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Rewind 10 seconds"
                >
                  <SkipBack className="size-3.5" weight="fill" />
                </button>
                <button
                  type="button"
                  onClick={toggle}
                  className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="size-3.5" weight="fill" />
                  ) : (
                    <Play className="size-3.5 translate-x-px" weight="fill" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => seek(Math.min(duration, currentTime + 10))}
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Forward 10 seconds"
                >
                  <SkipForward className="size-3.5" weight="fill" />
                </button>
              </div>
            )}

            <div className="mt-2 flex items-center gap-2">
              <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground sm:w-9">
                {formatPlaybackTime(currentTime)}
              </span>
              <div
                className="relative h-2 flex-1 touch-none rounded-full bg-muted sm:h-1.5"
                onPointerDown={handleSeekPointerDown}
                onPointerMove={handleSeekPointerMove}
                onPointerUp={handleSeekPointerUp}
                onPointerCancel={handleSeekPointerUp}
                role="slider"
                aria-valuemin={0}
                aria-valuemax={duration}
                aria-valuenow={currentTime}
                aria-label="Seek"
              >
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full bg-primary",
                    isDragging ? "transition-none" : "transition-[width]",
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-[10px] tabular-nums text-muted-foreground sm:w-9">
                {formatPlaybackTime(duration)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
