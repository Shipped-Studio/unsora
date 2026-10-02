"use client";

import { useState } from "react";
import {
  DownloadSimple,
  Trash,
  Warning,
  FileVideo,
  CheckCircle,
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

export interface VideoCardData {
  id: string;
  originalName: string;
  originalUrl: string;
  processedUrl?: string | null;
  status: string;
  error?: string | null;
}

interface VideoCardProps {
  video: VideoCardData;
  onDelete?: (id: string) => void;
  onClick?: () => void;
  displayMode?: "default" | "asset";
}

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  processing: "Processing…",
};

export function VideoCard({
  video,
  onDelete,
  onClick,
  displayMode = "default",
}: VideoCardProps) {
  const [hovered, setHovered] = useState(false);
  const isInProgress =
    video.status === "queued" || video.status === "processing";
  const isComplete = video.status === "completed";
  const isFailed = video.status === "failed";
  const outputUrl = video.processedUrl;
  const isAssetMode = displayMode === "asset";

  return (
    <div
      className={`group relative aspect-video cursor-pointer overflow-hidden rounded-xl border bg-card transition-all ${
        isAssetMode ? "" : "shadow-sm hover:shadow-md"
      }`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isComplete && outputUrl ? (
        <VideoThumbnail
          videoUrl={getCdnUrl(outputUrl)}
          alt={video.originalName}
          seekTo={0.5}
        />
      ) : isInProgress ? (
        <div
          className={`flex size-full flex-col items-center justify-center gap-2 bg-card px-5 text-center ${
            isAssetMode ? "" : "rounded-xl border border-dashed border-border"
          }`}
        >
          <Spinner />
          {!isAssetMode && (
            <p className="line-clamp-1 text-xs font-medium text-muted-foreground">
              {video.originalName}
            </p>
          )}
          <span className="text-xs text-muted-foreground">
            {STATUS_LABELS[video.status] ?? video.status}
          </span>
        </div>
      ) : isFailed ? (
        <div className="flex size-full flex-col items-center justify-center gap-2 px-5 text-center">
          <Warning className="size-6 text-destructive/70" />
          {!isAssetMode && (
            <p className="line-clamp-1 text-xs font-medium text-muted-foreground">
              {video.originalName}
            </p>
          )}
          <p className="text-[11px] text-destructive/80">
            {video.error || "Processing failed"}
          </p>
        </div>
      ) : (
        <div className="flex size-full items-center justify-center">
          <FileVideo className="size-8 text-muted-foreground/30" />
        </div>
      )}

      {isFailed && onDelete && (
        <DeleteFailedButton
          onConfirm={() => onDelete(video.id)}
          title="Delete video?"
          description="This will permanently remove this failed video. This action cannot be undone."
        />
      )}

      {/* Hover overlay for completed videos */}
      {isAssetMode && hovered && isComplete && outputUrl && (
        <div
          className="absolute inset-x-0 top-2 z-10 flex justify-end gap-1.5 px-2"
          onClick={(e) => e.stopPropagation()}
        >
          <a
            href={getCdnUrl(outputUrl, { download: true })}
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
                    This will permanently remove this processed video. This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => onDelete(video.id)}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      {hovered && !isAssetMode && isComplete && outputUrl && (
        <div className="absolute inset-0 flex flex-col justify-between bg-black/50 p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-success">
              <CheckCircle className="size-3" weight="fill" />
              Complete
            </span>
            <div className="flex gap-1.5">
              <a
                href={getCdnUrl(outputUrl, { download: true })}
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
                        This will permanently remove this processed video. This
                        action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => onDelete(video.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
          <p className="line-clamp-1 text-xs text-white/90">
            {video.originalName}
          </p>
        </div>
      )}
    </div>
  );
}
