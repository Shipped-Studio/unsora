"use client";

import {
  DownloadSimple,
  Trash,
  Warning,
  UserFocus,
  X,
  Play,
} from "@phosphor-icons/react";
import { getCdnUrl } from "@/lib/video-utils";
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
import { VideoThumbnail } from "@/components/ui/video-thumbnail";
import { cn } from "@/lib/utils";

export interface AvatarCardData {
  id: string;
  status: string;
  transcript: string;
  emotion?: string;
  outputUrl?: string | null;
  error?: string | null;
  createdAt?: string;
}

interface AvatarGenerationCardProps {
  generation: AvatarCardData;
  onDelete?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onPlay?: (generation: AvatarCardData) => void;
}

const STATUS_LABELS: Record<string, string> = {
  submitting: "Submitting…",
  QUEUED: "Queued",
  PROCESSING: "Generating…",
};

export function AvatarGenerationCard({
  generation,
  onDelete,
  onDismiss,
  onPlay,
}: AvatarGenerationCardProps) {
  const videoUrl = generation.outputUrl;
  const isInProgress =
    generation.status === "submitting" ||
    generation.status === "QUEUED" ||
    generation.status === "PROCESSING";
  const isFailed = generation.status === "FAILED";
  const isCompleted = generation.status === "COMPLETED" && videoUrl;
  const preview =
    generation.transcript.length > 80
      ? `${generation.transcript.slice(0, 80)}…`
      : generation.transcript;

  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
      <div className="relative aspect-square bg-card">
        {isCompleted && videoUrl ? (
          <VideoThumbnail videoUrl={getCdnUrl(videoUrl)} alt={preview} />
        ) : isInProgress ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Spinner className="size-6" />
            <span className="text-xs">
              {STATUS_LABELS[generation.status] ?? generation.status}
            </span>
          </div>
        ) : isFailed ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 px-3 text-center">
            <Warning className="size-6 text-destructive/70" />
            <p className="line-clamp-3 text-xs text-destructive/80">
              {generation.error || "Generation failed"}
            </p>
          </div>
        ) : (
          <div className="flex size-full items-center justify-center">
            <UserFocus
              className="size-10 text-muted-foreground/30"
              weight="duotone"
            />
          </div>
        )}

        {isCompleted && onPlay && (
          <button
            type="button"
            onClick={() => onPlay(generation)}
            className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100"
            aria-label="Play avatar video"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md">
              <Play className="size-4 translate-x-px" weight="fill" />
            </span>
          </button>
        )}

        <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
          {isCompleted && videoUrl && (
            <a
              href={getCdnUrl(videoUrl, { download: true })}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-background/80 p-1.5 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
              aria-label="Download video"
            >
              <DownloadSimple className="size-3.5" />
            </a>
          )}
          {isCompleted && onDelete && (
            <AlertDialog>
              <AlertDialogTrigger className="rounded-md bg-background/80 p-1.5 text-muted-foreground backdrop-blur-sm transition-colors hover:text-destructive">
                <Trash className="size-3.5" />
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete avatar?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove this generated video.
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
                className="rounded-md bg-background/80 p-1.5 text-muted-foreground backdrop-blur-sm transition-colors hover:text-destructive"
                aria-label="Delete failed avatar"
              >
                <X className="size-3.5" weight="bold" />
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete avatar?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove this failed generation. This
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
              className="rounded-md bg-background/80 p-1.5 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="size-3.5" weight="bold" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-0.5 p-2.5">
        <p className="line-clamp-2 text-xs text-foreground/90">{preview}</p>
        {generation.emotion && (
          <p className="text-[10px] capitalize text-muted-foreground">
            {generation.emotion}
          </p>
        )}
      </div>
    </div>
  );
}
