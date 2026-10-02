"use client";

import Image from "next/image";
import {
  DownloadSimple,
  FilmStrip,
  Play,
  TrendUp,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import { Spinner } from "@/components/ui/spinner";
import { VideoThumbnail } from "@/components/ui/video-thumbnail";
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
import { cn } from "@/lib/utils";
import { getCdnUrl } from "@/lib/video-utils";
import {
  getClipThumbnailUrl,
  getClipVideoUrl,
  type AIClippingClip,
} from "@/hooks/use-ai-clippings";
import { clipAspectClass, normalizeClipScore } from "./clip-ratio";

const cdnLoader = ({ src }: { src: string }) => src;

interface AIClippingClipCardProps {
  clip: AIClippingClip;
  ratio?: string | null;
  jobProcessing?: boolean;
  onPlay?: () => void;
  onDelete?: () => void;
}

function formatTimestamp(seconds?: number | null) {
  if (seconds == null || Number.isNaN(seconds)) return null;
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function scoreBadgeClass(score: number) {
  if (score >= 80) return "bg-success text-success-foreground";
  if (score >= 60) return "bg-warning text-warning-foreground";
  return "bg-background/90 text-foreground";
}

export function AIClippingClipCard({
  clip,
  ratio,
  jobProcessing = false,
  onPlay,
  onDelete,
}: AIClippingClipCardProps) {
  const thumbnailUrl = getClipThumbnailUrl(clip);
  const videoUrl = getClipVideoUrl(clip);
  const score = normalizeClipScore(clip.metadata?.score);
  const duration = formatTimestamp(clip.duration);
  const startTime = formatTimestamp(clip.startTime);
  const isFailed = clip.status === "FAILED";
  const isLoading = jobProcessing && !thumbnailUrl && !videoUrl && !isFailed;
  const canOpen = Boolean(
    onPlay && (videoUrl || thumbnailUrl || clip.metadata?.desc),
  );

  return (
    <div className="group overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        disabled={!canOpen}
        onClick={() => onPlay?.()}
        className={cn(
          "relative block w-full bg-card",
          clipAspectClass(ratio),
          canOpen ? "cursor-pointer" : "cursor-default",
        )}
      >
        {thumbnailUrl ? (
          <Image
            loader={cdnLoader}
            src={getCdnUrl(thumbnailUrl)}
            alt={clip.title || `Clip ${clip.order + 1}`}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : videoUrl ? (
          <VideoThumbnail
            videoUrl={getCdnUrl(videoUrl)}
            alt={clip.title || `Clip ${clip.order + 1}`}
          />
        ) : isLoading ? (
          <div className="flex size-full flex-col items-center justify-center gap-2">
            <Spinner className="size-5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">
              Detecting clip…
            </span>
          </div>
        ) : isFailed ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 px-3 text-center">
            <Warning className="size-5 text-destructive/70" />
            <span className="text-[11px] text-destructive/80">
              {clip.error || "Clip failed"}
            </span>
          </div>
        ) : (
          <div className="flex size-full items-center justify-center">
            <FilmStrip className="size-8 text-muted-foreground/30" />
          </div>
        )}

        {canOpen && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/35">
            <span className="flex size-11 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              <Play className="size-5" weight="fill" />
            </span>
          </div>
        )}

        {score != null && (
          <span
            className={cn(
              "absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm",
              scoreBadgeClass(score),
            )}
            title="Virality score"
          >
            <TrendUp className="size-3" weight="bold" />
            {score}
          </span>
        )}

        {duration && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
            {duration}
          </span>
        )}

        <div
          className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          {videoUrl && (
            <a
              href={getCdnUrl(videoUrl, { download: true })}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-background/90 p-1.5 text-foreground transition-colors hover:bg-background"
              aria-label="Download clip"
            >
              <DownloadSimple className="size-4" />
            </a>
          )}
          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger
                className="rounded-md bg-background/90 p-1.5 text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label="Delete clip"
              >
                <Trash className="size-4" />
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this clip?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes &ldquo;{clip.title || `Clip ${clip.order + 1}`}
                    &rdquo; from the job. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={onDelete}>
                    Delete clip
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </button>

      <div className="space-y-0.5 p-2.5">
        <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
          {clip.title || `Clip ${clip.order + 1}`}
        </p>
        {startTime && (
          <p className="text-[11px] text-muted-foreground">
            From {startTime} in source
          </p>
        )}
      </div>
    </div>
  );
}
