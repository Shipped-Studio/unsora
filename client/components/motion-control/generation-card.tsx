"use client";

import { useState } from "react";
import {
  DownloadSimple,
  Trash,
  Warning,
  FilmStrip,
  X,
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
import { DeleteFailedButton } from "@/components/ui/delete-failed-button";

export interface MotionCardData {
  id: string;
  status: string;
  prompt: string;
  outputUrl?: string | null;
  error?: string | null;
  model?: string;
  createdAt?: string;
}

interface MotionCardProps {
  generation: MotionCardData;
  onDelete?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onClick?: (generation: MotionCardData) => void;
  displayMode?: "default" | "asset";
}

const STATUS_LABELS: Record<string, string> = {
  submitting: "Submitting…",
  QUEUED: "Queued",
  PROCESSING: "Generating…",
};

export function MotionGenerationCard({
  generation,
  onDelete,
  onDismiss,
  onClick,
  displayMode = "default",
}: MotionCardProps) {
  const [hovered, setHovered] = useState(false);
  const videoUrl = generation.outputUrl;
  const isInProgress =
    generation.status === "submitting" ||
    generation.status === "QUEUED" ||
    generation.status === "PROCESSING";
  const isFailed = generation.status === "FAILED";
  const isCompleted = generation.status === "COMPLETED" && videoUrl;
  const isAssetMode = displayMode === "asset";

  return (
    <div
      className={`group relative aspect-video overflow-hidden rounded-xl border bg-card transition-all ${
        isAssetMode ? "" : "shadow-sm hover:shadow-md"
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => isCompleted && onClick?.(generation)}
      style={{ cursor: isCompleted && onClick ? "pointer" : "default" }}
    >
      {videoUrl && !isInProgress ? (
        <VideoThumbnail videoUrl={getCdnUrl(videoUrl)} alt={generation.prompt} />
      ) : isInProgress ? (
        <div
          className={`flex size-full flex-col items-center justify-center gap-2 bg-card px-5 text-center ${
            isAssetMode ? "" : "rounded-xl border border-dashed border-border"
          }`}
        >
          <Spinner />
          {!isAssetMode && (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {generation.prompt}
            </p>
          )}
          <span className="text-xs text-muted-foreground">
            {STATUS_LABELS[generation.status] ?? generation.status}
          </span>
        </div>
      ) : isFailed ? (
        <div className="flex size-full flex-col items-center justify-center gap-2 px-5 text-center">
          <Warning className="size-6 text-destructive/70" />
          {!isAssetMode && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {generation.prompt}
            </p>
          )}
          <p className="text-[11px] text-destructive/80">
            {generation.error || "Generation failed"}
          </p>
        </div>
      ) : (
        <div className="flex size-full items-center justify-center">
          <FilmStrip className="size-8 text-muted-foreground/30" />
        </div>
      )}

      {isInProgress && !isAssetMode && onDismiss && (
        <button
          onClick={() => onDismiss(generation.id)}
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" weight="bold" />
        </button>
      )}

      {isFailed && onDelete && (
        <DeleteFailedButton
          onConfirm={() => onDelete(generation.id)}
          title="Delete video?"
          description="This will permanently remove this failed video generation. This action cannot be undone."
        />
      )}

      {isAssetMode && hovered && videoUrl && !isInProgress && (
        <div
          className="absolute inset-x-0 top-2 z-10 flex justify-end gap-1.5 px-2"
          onClick={(e) => e.stopPropagation()}
        >
          <a
            href={getCdnUrl(videoUrl, { download: true })}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-background/85 p-1.5 text-foreground transition-colors hover:bg-background"
          >
            <DownloadSimple className="size-4" />
          </a>
          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger className="rounded-md bg-destructive p-1.5 text-destructive-foreground transition-opacity hover:opacity-90">
                <Trash className="size-4" />
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete video?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove this generated video. This
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
        </div>
      )}

      {!isAssetMode && hovered && videoUrl && !isInProgress && (
        <div className="absolute inset-0 flex flex-col justify-between bg-black/50 p-3">
          <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <a
              href={getCdnUrl(videoUrl, { download: true })}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-black/40 p-1.5 text-white transition-colors hover:bg-black/60"
            >
              <DownloadSimple className="size-4" />
            </a>
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger className="rounded-md bg-black/40 p-1.5 text-white transition-colors hover:bg-destructive">
                  <Trash className="size-4" />
                </AlertDialogTrigger>
                <AlertDialogContent size="sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete video?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove this generated video. This
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
          </div>
          <p className="line-clamp-2 text-xs text-white/90">
            {generation.prompt}
          </p>
        </div>
      )}
    </div>
  );
}
