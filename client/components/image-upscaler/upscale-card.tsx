"use client";

import { useState } from "react";
import { DownloadSimple, Trash, Warning, ImageSquare, CheckCircle } from "@phosphor-icons/react";
import Image from "next/image";
import { getCdnUrl } from "@/lib/video-utils";
import { Spinner } from "@/components/ui/spinner";
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

const cdnLoader = ({ src }: { src: string }) => src;

export interface UpscaleCardData {
  id: string;
  status: string;
  originalName?: string;
  inputUrl?: string | null;
  outputUrl?: string | null;
  error?: string | null;
}

interface UpscaleCardProps {
  job: UpscaleCardData;
  onDelete?: (id: string) => void;
  onClick?: () => void;
  displayMode?: "default" | "asset";
}

const STATUS_LABELS: Record<string, string> = {
  submitting: "Submitting…",
  QUEUED: "Queued",
  PROCESSING: "Processing…",
};

export function UpscaleCard({
  job,
  onDelete,
  onClick,
  displayMode = "default",
}: UpscaleCardProps) {
  const [hovered, setHovered] = useState(false);
  const isInProgress =
    job.status === "submitting" ||
    job.status === "QUEUED" ||
    job.status === "PROCESSING";
  const isComplete = job.status === "COMPLETED";
  const isFailed = job.status === "FAILED";
  const outputUrl = job.outputUrl;
  const inputUrl = job.inputUrl;
  const displayUrl = isComplete ? outputUrl : inputUrl;
  const isAssetMode = displayMode === "asset";

  return (
    <div
      className={`group relative aspect-square overflow-hidden rounded-xl border bg-card transition-all cursor-pointer ${
        isAssetMode ? "" : "shadow-sm hover:shadow-md"
      }`}
      onClick={() => !isInProgress && onClick?.()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image display */}
      {displayUrl ? (
        <Image
          loader={cdnLoader}
          src={getCdnUrl(displayUrl)}
          alt={job.originalName || "Image"}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <ImageSquare className="size-8 text-muted-foreground/30" />
        </div>
      )}

      {/* In-progress overlay */}
      {isInProgress && (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-2 px-5 text-center ${
            isAssetMode ? "bg-card" : "bg-black/60"
          }`}
        >
          <Spinner className={isAssetMode ? "" : "text-white"} />
          {!isAssetMode && job.originalName && (
            <p className="line-clamp-1 text-xs font-medium text-white/80">
              {job.originalName}
            </p>
          )}
          <span className={isAssetMode ? "text-xs text-muted-foreground" : "rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-medium text-white"}>
            {STATUS_LABELS[job.status] ?? job.status}
          </span>
        </div>
      )}

      {/* Failed overlay */}
      {isFailed && (
        <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 px-5 text-center ${isAssetMode ? "bg-card" : "bg-black/60"}`}>
          <Warning className={`size-6 ${isAssetMode ? "text-destructive/70" : "text-destructive"}`} />
          <p className={`line-clamp-2 text-xs ${isAssetMode ? "text-destructive/80" : "text-white/80"}`}>
            {job.error || "Upscaling failed"}
          </p>
          {!isAssetMode && onDelete && (
            <AlertDialog>
              <AlertDialogTrigger
                className="mt-1 rounded-md bg-white/15 px-3 py-1 text-[11px] font-medium text-white transition-colors hover:bg-destructive"
                onClick={(e) => e.stopPropagation()}
              >
                Delete
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete job?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove this upscale job. This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => onDelete(job.id)}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

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
                  <AlertDialogTitle>Delete image?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove this upscaled image. This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => onDelete(job.id)}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      {/* Hover overlay for completed */}
      {!isAssetMode && hovered && isComplete && outputUrl && (
        <div
          className="absolute inset-0 flex flex-col justify-between bg-black/50 p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-success">
              <CheckCircle className="size-3" weight="fill" />
              Upscaled
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
                      <AlertDialogTitle>Delete image?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove this upscaled image. This
                        action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => onDelete(job.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
          <p className="line-clamp-1 text-xs text-white/90">{job.originalName}</p>
        </div>
      )}
    </div>
  );
}
