"use client";

import {
  DownloadSimple,
  Trash,
  Warning,
  MusicNotes,
  X,
  Play,
  Pause,
} from "@phosphor-icons/react";
import { getCdnUrl } from "@/lib/video-utils";
import { useMusicPlayer } from "@/contexts/music-player-context";
import { SyncedLyrics } from "@/components/music-generator/synced-lyrics";
import { parseLyricLines } from "@/lib/music-lyrics";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { formatDownloadFilename, formatTrackLabel, formatTrackTitle } from "@/lib/music-track";

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
  onDelete?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  submitting: "Submitting…",
  QUEUED: "Queued",
  PROCESSING: "Generating…",
};

const MODEL_LABELS: Record<string, string> = {
  auto: "Mureka V9",
  "mureka-9": "Mureka V9",
  "mureka-8": "Mureka V8",
  "mureka-o2": "Mureka O2",
  "mureka-7.6": "Mureka V7.6",
  "mureka-7.5": "Mureka V7.5",
};

function getPreviewLyric(lyrics: string): string | null {
  const lines = parseLyricLines(lyrics).filter(
    (line) => !/^\[[^\]]+\]$/.test(line),
  );
  return lines[0] ?? null;
}

export function MusicGenerationCard({
  generation,
  onDelete,
  onDismiss,
}: MusicGenerationCardProps) {
  const { currentTrack, isPlaying, isBuffering, currentTime, duration, play, toggle } =
    useMusicPlayer();

  const audioUrl = generation.outputUrl;
  const isInProgress =
    generation.status === "submitting" ||
    generation.status === "QUEUED" ||
    generation.status === "PROCESSING";
  const isFailed = generation.status === "FAILED";
  const isCompleted = generation.status === "COMPLETED" && audioUrl;
  const modelLabel =
    MODEL_LABELS[generation.model ?? "auto"] ?? generation.model ?? "Mureka";
  const title =
    generation.trackNumber != null && generation.trackNumber > 0
      ? formatTrackTitle(generation.trackNumber, generation.songTitle)
      : generation.songTitle || generation.prompt || "Untitled song";
  const isCurrentTrack = currentTrack?.id === generation.id;
  const isCurrentPlaying = isCurrentTrack && isPlaying;
  const previewLyric = generation.lyrics
    ? getPreviewLyric(generation.lyrics)
    : null;
  const showSyncedLyrics =
    isCompleted &&
    isCurrentTrack &&
    generation.lyrics &&
    (isPlaying || currentTime > 0);

  const handlePlayToggle = () => {
    if (!audioUrl) return;

    if (isCurrentTrack) {
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
  };

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card transition-shadow hover:shadow-md",
        isCurrentTrack && "border-primary/30 ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-start gap-2.5 p-2.5 sm:gap-3 sm:p-3">
        {isCompleted ? (
          <button
            type="button"
            onClick={handlePlayToggle}
            className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-primary/30 via-primary/10 to-background text-primary sm:size-11"
            aria-label={isCurrentPlaying ? "Pause song" : "Play song"}
          >
            <MusicNotes
              className="absolute size-4 opacity-25 sm:size-5"
              weight="duotone"
            />
            <span className="relative flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              {isCurrentTrack && isBuffering ? (
                <Spinner className="size-3.5" />
              ) : isCurrentPlaying ? (
                <Pause className="size-3.5" weight="fill" />
              ) : (
                <Play className="size-3.5 translate-x-px" weight="fill" />
              )}
            </span>
          </button>
        ) : isInProgress ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-card sm:size-11">
            <Spinner className="size-4" />
          </div>
        ) : isFailed ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-destructive/10 sm:size-11">
            <Warning className="size-4 text-destructive/70" />
          </div>
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted/40 sm:size-11">
            <MusicNotes className="size-4 text-muted-foreground/40" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {title}
              </p>
              <p className="truncate text-[10px] text-muted-foreground sm:text-[11px]">
                {isInProgress
                  ? (STATUS_LABELS[generation.status] ?? generation.status)
                  : isFailed
                    ? generation.error || "Generation failed"
                    : generation.trackNumber
                      ? `${modelLabel} · #${generation.trackNumber}`
                      : modelLabel}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              {isCompleted && audioUrl && (
                <a
                  href={getCdnUrl(audioUrl, { download: true })}
                  download={
                    generation.trackNumber
                      ? formatDownloadFilename(
                          generation.trackNumber,
                          generation.songTitle,
                        )
                      : undefined
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Download song"
                >
                  <DownloadSimple className="size-3.5" />
                </a>
              )}
              {isCompleted && onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                    <Trash className="size-3.5" />
                  </AlertDialogTrigger>
                  <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete song?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove this generated song. This
                        action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => onDelete(generation.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {isFailed && onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete failed song"
                  >
                    <X className="size-3.5" weight="bold" />
                  </AlertDialogTrigger>
                  <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete song?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove this failed song. This
                        action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => onDelete(generation.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {isInProgress && onDismiss && (
                <button
                  onClick={() => onDismiss(generation.id)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Dismiss"
                >
                  <X className="size-3.5" weight="bold" />
                </button>
              )}
            </div>
          </div>

          {showSyncedLyrics ? (
            <SyncedLyrics
              lyrics={generation.lyrics}
              currentTime={currentTime}
              duration={duration}
              isActive
              variant="compact"
              className="mt-1.5"
            />
          ) : previewLyric ? (
            <p className="mt-1 line-clamp-1 text-[11px] leading-snug text-muted-foreground/65">
              {previewLyric}
            </p>
          ) : isCompleted ? (
            <p className="mt-1 text-[11px] italic text-muted-foreground/60">
              Instrumental track
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
