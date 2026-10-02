"use client";

import { useState } from "react";
import {
  DownloadSimple,
  Trash,
  Warning,
  ImageSquare,
  X,
} from "@phosphor-icons/react";
import Image from "next/image";
import { getCdnUrl } from "@/lib/video-utils";
import { Spinner } from "@/components/ui/spinner";

const cdnLoader = ({ src }: { src: string }) => src;
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
import { DeleteFailedButton } from "@/components/ui/delete-failed-button";

export interface GenerationCardData {
  id: string;
  status: string;
  prompt: string;
  outputUrl?: string | null;
  thumbnailUrl?: string | null;
  error?: string | null;
}

interface GenerationCardProps {
  generation: GenerationCardData;
  onDelete?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onClick?: () => void;
  displayMode?: "default" | "asset";
  aspectClassName?: string;
}

const STATUS_LABELS: Record<string, string> = {
  submitting: "Submitting…",
  QUEUED: "Queued",
  PROCESSING: "Processing…",
};

export function GenerationCard({
  generation,
  onDelete,
  onDismiss,
  onClick,
  displayMode = "default",
  aspectClassName = "aspect-square",
}: GenerationCardProps) {
  const [hovered, setHovered] = useState(false);
  const imageUrl = generation.outputUrl || generation.thumbnailUrl;
  const isInProgress =
    generation.status === "submitting" ||
    generation.status === "QUEUED" ||
    generation.status === "PROCESSING";
  const isFailed = generation.status === "FAILED";
  const isAssetMode = displayMode === "asset";

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border bg-card transition-all ${aspectClassName} ${
        isAssetMode
          ? "cursor-pointer"
          : "cursor-pointer shadow-sm hover:shadow-md"
      }`}
      onClick={() => {
        if (!isInProgress) onClick?.();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Completed with image ── */}
      {imageUrl && !isInProgress ? (
        <Image
          loader={cdnLoader}
          src={getCdnUrl(imageUrl)}
          alt={generation.prompt}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover"
        />
      ) : isInProgress ? (
        /* ── In-progress states ── */
        <div
          className={`flex size-full flex-col items-center justify-center gap-2 px-5 text-center ${
            isAssetMode
              ? "bg-card"
              : "rounded-xl border border-dashed border-border bg-card"
          }`}
        >
          <Spinner />
          <span className="text-xs text-muted-foreground">
            {STATUS_LABELS[generation.status] ?? generation.status}
          </span>
          {!isAssetMode && (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {generation.prompt}
            </p>
          )}
          {!isAssetMode && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {STATUS_LABELS[generation.status] ?? generation.status}
            </span>
          )}
        </div>
      ) : isFailed ? (
        /* ── Failed state ── */
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
        /* ── No image fallback ── */
        <div className="flex size-full items-center justify-center">
          <ImageSquare className="size-8 text-muted-foreground/30" />
        </div>
      )}

      {/* ── Delete control for failed generations (all display modes) ── */}
      {isFailed && onDelete && (
        <DeleteFailedButton
          onConfirm={() => onDelete(generation.id)}
          title="Delete generation?"
          description="This will permanently remove this failed generation. This action cannot be undone."
        />
      )}

      {/* ── Dismiss button for in-progress ── */}
      {isInProgress && !isAssetMode && onDismiss && (
        <div
          className="absolute right-2 top-2 flex gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onDismiss(generation.id)}
            className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" weight="bold" />
          </button>
        </div>
      )}

      {isAssetMode && imageUrl && !isInProgress && !isFailed && (
        <div
          className="absolute inset-x-0 top-2 z-10 flex items-center justify-end gap-1.5 px-2 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <a
            href={getCdnUrl(imageUrl, { download: true })}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-background/85 p-1.5 text-foreground transition-colors hover:bg-background"
          >
            <DownloadSimple className="size-4" />
          </a>
          {onDelete && (
            <AlertDialog>
              {/* Icon color fix: force icon white when bg red */}
              <AlertDialogTrigger className="rounded-md bg-destructive p-1.5 transition-opacity hover:opacity-90">
                <Trash className="size-4 text-destructive-foreground" />
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete image?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove this generated image. This
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

      {/* ── Hover overlay for completed images ── */}
      {!isAssetMode && hovered && imageUrl && !isInProgress && !isFailed && (
        <div className="absolute inset-0 flex flex-col justify-between bg-black/50 p-3">
          <div
            className="flex justify-end gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={getCdnUrl(imageUrl, { download: true })}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-black/40 p-1.5 text-white transition-colors hover:bg-black/60"
            >
              <DownloadSimple className="size-4" />
            </a>
            {onDelete && (
              <AlertDialog>
                {/* Icon color fix: force icon white when bg red */}
                <AlertDialogTrigger className="rounded-md bg-black/40 p-1.5 text-white transition-colors hover:bg-destructive">
                  <Trash className="size-4 text-white" />
                </AlertDialogTrigger>
                <AlertDialogContent size="sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete image?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove this generated image. This
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
