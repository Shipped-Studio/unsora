"use client";

import { useState } from "react";
import {
  DotsThree,
  DownloadSimple,
  Pause,
  Play,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { SyncedLyrics } from "@/components/music-generator/synced-lyrics";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useMusicPlayer } from "@/contexts/music-player-context";
import { parseLyricLines } from "@/lib/music-lyrics";
import { formatDownloadFilename, formatTrackLabel } from "@/lib/music-track";
import { friendlyGenerationError } from "@/components/generator/generation-error";
import {
  TILE_CLASS,
  TILE_GHOST_BUTTON_CLASS,
  TILE_SKELETON_BAR_CLASS,
  TILE_SKELETON_CLASS,
} from "@/components/generator/result-tile";
import { cn } from "@/lib/utils";
import { getCdnUrl } from "@/lib/video-utils";

export interface MusicCardData {
  id: string;
  status: string;
  lyrics: string;
  prompt: string;
  outputUrl?: string | null;
  error?: string | null;
  model?: string;
  trackNumber?: number;
  songTitle?: string;
  createdAt?: string;
}

interface MusicGenerationCardProps {
  generation: MusicCardData;
  /** Deletes a saved song (asks first). */
  onDelete?: (id: string) => void;
  /** Hides a song that's still starting or failed to start. */
  onDismiss?: (id: string) => void;
}

const MODEL_LABELS: Record<string, string> = {
  auto: "Mureka V9",
  "mureka-9": "Mureka V9",
  "mureka-8": "Mureka V8",
  "mureka-o2": "Mureka O2",
  "mureka-7.6": "Mureka V7.6",
  "mureka-7.5": "Mureka V7.5",
};

function firstLyricLine(lyrics: string): string | null {
  return (
    parseLyricLines(lyrics).find((line) => !/^\[[^\]]+\]$/.test(line)) ?? null
  );
}

export function MusicGenerationCard({
  generation,
  onDelete,
  onDismiss,
}: MusicGenerationCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { currentTrack, isPlaying, isBuffering, currentTime, duration, play, toggle } =
    useMusicPlayer();

  const audioUrl =
    generation.status === "COMPLETED" ? generation.outputUrl : null;
  const inProgress =
    generation.status === "submitting" ||
    generation.status === "QUEUED" ||
    generation.status === "PROCESSING";
  const failed = generation.status === "FAILED";

  const modelLabel =
    MODEL_LABELS[generation.model ?? "auto"] ?? generation.model ?? "Mureka";
  const trackLabel =
    generation.trackNumber != null && generation.trackNumber > 0
      ? formatTrackLabel(generation.trackNumber)
      : null;
  const title =
    generation.songTitle || trackLabel || generation.prompt || "Untitled song";
  const isCurrent = currentTrack?.id === generation.id;
  const lyricPreview = generation.lyrics
    ? firstLyricLine(generation.lyrics)
    : null;
  const showSyncedLyrics =
    audioUrl &&
    isCurrent &&
    generation.lyrics &&
    (isPlaying || currentTime > 0);

  const status = inProgress
    ? generation.status === "QUEUED"
      ? "Queued"
      : generation.status === "submitting"
        ? "Starting"
        : "Generating"
    : failed
      ? friendlyGenerationError(generation.error)
      : [trackLabel, modelLabel].filter(Boolean).join(" · ");

  function handlePlay() {
    if (!audioUrl) return;
    if (isCurrent) {
      toggle();
      return;
    }
    play({
      id: generation.id,
      title,
      subtitle: modelLabel,
      audioUrl,
      lyrics: generation.lyrics,
    });
  }

  return (
    <article
      className={cn(
        "flex items-start gap-3 p-3",
        TILE_CLASS,
        isCurrent && "ring-2 ring-ring/50",
      )}
    >
      {audioUrl ? (
        <Button
          variant="outline"
          size="icon"
          onClick={handlePlay}
          aria-label={
            isCurrent && isPlaying ? `Pause ${title}` : `Play ${title}`
          }
        >
          {isCurrent && isBuffering ? (
            <Spinner />
          ) : isCurrent && isPlaying ? (
            <Pause weight="fill" />
          ) : (
            <Play weight="fill" />
          )}
        </Button>
      ) : (
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md",
            failed ? "bg-destructive-subtle" : "bg-card",
          )}
        >
          {failed ? (
            <WarningCircle className="size-4 text-destructive" />
          ) : (
            <Spinner className="text-muted-foreground" />
          )}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={title}>
          {title}
        </p>
        <p
          className="truncate text-xs text-muted-foreground"
          title={failed ? (generation.error ?? undefined) : undefined}
        >
          {failed ? <span className="sr-only">Generation failed. </span> : null}
          {status}
        </p>
        {showSyncedLyrics ? (
          <SyncedLyrics
            lyrics={generation.lyrics}
            currentTime={currentTime}
            duration={duration}
            isActive
            variant="compact"
            className="mt-2"
          />
        ) : audioUrl ? (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {lyricPreview ?? "Instrumental"}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {audioUrl ? (
          <a
            href={getCdnUrl(audioUrl, {
              download: generation.trackNumber
                ? formatDownloadFilename(
                    generation.trackNumber,
                    generation.songTitle,
                  )
                : true,
            })}
            download
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
              TILE_GHOST_BUTTON_CLASS,
            )}
            aria-label={`Download ${title}`}
          >
            <DownloadSimple />
          </a>
        ) : null}

        {onDismiss && (inProgress || failed) ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className={TILE_GHOST_BUTTON_CLASS}
            onClick={() => onDismiss(generation.id)}
            aria-label={`Dismiss ${title}`}
          >
            <X />
          </Button>
        ) : onDelete && failed ? (
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setConfirmOpen(true)}
            aria-label={`Delete ${title}`}
          >
            <Trash />
          </Button>
        ) : onDelete && audioUrl ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={TILE_GHOST_BUTTON_CLASS}
                  aria-label={`More actions for ${title}`}
                />
              }
            >
              <DotsThree weight="bold" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {onDelete ? (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this song?</AlertDialogTitle>
              <AlertDialogDescription>
                {title} will be removed from your songs. This can&apos;t be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  setConfirmOpen(false);
                  onDelete(generation.id);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </article>
  );
}

export function AudioRowSkeleton() {
  return (
    <div className={cn("flex items-center gap-3 p-3", TILE_SKELETON_CLASS)}>
      <Skeleton className={cn("size-9 rounded-md", TILE_SKELETON_BAR_CLASS)} />
      <div className="flex-1 space-y-2">
        <Skeleton className={cn("h-4 w-1/2", TILE_SKELETON_BAR_CLASS)} />
        <Skeleton className={cn("h-3 w-1/3", TILE_SKELETON_BAR_CLASS)} />
      </div>
    </div>
  );
}
