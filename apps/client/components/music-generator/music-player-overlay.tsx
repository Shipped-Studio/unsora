"use client";

import { useCallback, useId, useRef } from "react";
import {
  ArrowClockwise,
  CornersIn,
  CornersOut,
  Minus,
  MusicNotes,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from "@phosphor-icons/react";
import { useMusicPlayer } from "@/contexts/music-player-context";
import { SyncedLyrics } from "@/components/music-generator/synced-lyrics";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { useMusicPlayerDockHeight } from "@/hooks/use-music-player-dock-height";
import {
  useCollapseExpandedOnMobile,
  usePrefersReducedMotion,
} from "@/hooks/use-music-player-responsive";
import { MUSIC_PLAYER_SHELL_CLASS } from "@/lib/layout-classes";
import { formatPlaybackTime } from "@/lib/music-lyrics";
import { cn } from "@/lib/utils";

/**
 * Floating player for generated songs. It's anchored to the bottom-right of
 * the viewport (full width on phones) and publishes its height as
 * --music-player-height so tool composers can sit above it.
 */
export function MusicPlayerOverlay() {
  const shellRef = useRef<HTMLDivElement>(null);
  const seekLabelId = useId();
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
  const collapse = useCallback(() => setPlayerView("mini"), [setPlayerView]);
  useCollapseExpandedOnMobile(isExpanded, collapse);

  if (!currentTrack) return null;

  const title = currentTrack.title || "Untitled song";

  return (
    <div
      ref={shellRef}
      role="region"
      aria-label="Music player"
      className={cn(
        MUSIC_PLAYER_SHELL_CLASS,
        "transition-opacity duration-200",
        isMinimized && "max-sm:left-auto sm:w-auto",
      )}
    >
      {isMinimized ? (
        <Button
          variant="outline"
          size="icon-lg"
          onClick={() => setPlayerView("mini")}
          aria-label={`Open music player, ${isPlaying ? "playing" : "paused"}: ${title}`}
          className="rounded-full bg-popover shadow-md dark:bg-popover"
        >
          {isBuffering ? (
            <Spinner />
          ) : isPlaying ? (
            <Pause weight="fill" />
          ) : (
            <MusicNotes />
          )}
        </Button>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-md">
          {isExpanded && currentTrack.lyrics ? (
            <div className="border-b px-4 py-3">
              <SyncedLyrics
                lyrics={currentTrack.lyrics}
                currentTime={currentTime}
                duration={duration}
                isActive={isPlaying || currentTime > 0}
                variant="overlay"
                className="max-h-40"
              />
            </div>
          ) : null}

          <div className="space-y-2 p-3">
            {playbackError ? (
              <div
                role="alert"
                className="flex items-center justify-between gap-2 rounded-md bg-destructive/5 px-2.5 py-1.5"
              >
                <p className="text-xs text-destructive">{playbackError}</p>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={retryPlay}
                  className="text-destructive hover:text-destructive"
                >
                  <ArrowClockwise />
                  Retry
                </Button>
              </div>
            ) : null}

            <div className="flex items-center gap-2.5">
              <Button
                variant="secondary"
                size="icon"
                onClick={toggle}
                disabled={isBuffering && !isPlaying}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isBuffering ? (
                  <Spinner />
                ) : isPlaying ? (
                  <Pause weight="fill" />
                ) : (
                  <Play weight="fill" />
                )}
              </Button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{title}</p>
                {currentTrack.subtitle ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {currentTrack.subtitle}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center">
                {currentTrack.lyrics ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="max-sm:hidden"
                    onClick={() =>
                      setPlayerView(isExpanded ? "mini" : "expanded")
                    }
                    aria-label={isExpanded ? "Hide lyrics" : "Show lyrics"}
                    aria-pressed={isExpanded}
                  >
                    {isExpanded ? <CornersIn /> : <CornersOut />}
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={minimizePlayer}
                  aria-label="Minimize player"
                >
                  <Minus />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={stop}
                  aria-label="Close player"
                >
                  <X />
                </Button>
              </div>
            </div>

            {isExpanded ? (
              <div className="hidden items-center justify-center gap-1 sm:flex">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => seek(Math.max(0, currentTime - 10))}
                  aria-label="Back 10 seconds"
                >
                  <SkipBack weight="fill" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => seek(Math.min(duration, currentTime + 10))}
                  aria-label="Forward 10 seconds"
                >
                  <SkipForward weight="fill" />
                </Button>
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <span id={seekLabelId} className="sr-only">
                Playback position
              </span>
              <span className="w-9 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {formatPlaybackTime(currentTime)}
              </span>
              <Slider
                value={[Math.min(currentTime, duration || 0)]}
                min={0}
                max={duration > 0 ? duration : 1}
                step={0.1}
                disabled={duration <= 0}
                onValueChange={(value) => {
                  const next = Array.isArray(value) ? value[0] : value;
                  if (typeof next === "number") seek(next);
                }}
                aria-labelledby={seekLabelId}
                className="flex-1"
              />
              <span className="w-9 shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatPlaybackTime(duration)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
