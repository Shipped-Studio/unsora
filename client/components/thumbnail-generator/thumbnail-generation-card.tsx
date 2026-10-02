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

export interface ThumbnailGenerationCardData {
  id: string;
  status: string;
  prompt: string;
  outputUrl?: string | null;
  thumbnailUrl?: string | null;
  error?: string | null;
}

interface ThumbnailGenerationCardProps {
  generation: ThumbnailGenerationCardData;
  onDelete?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onClick?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  submitting: "Submitting…",
  QUEUED: "Queued",
  PROCESSING: "Processing…",
};

export function ThumbnailGenerationCard({
  generation,
  onDelete,
  onDismiss,
  onClick,
}: ThumbnailGenerationCardProps) {
  const [hovered, setHovered] = useState(false);
  const imageUrl = generation.outputUrl || generation.thumbnailUrl;
  const isInProgress =
    generation.status === "submitting" ||
    generation.status === "QUEUED" ||
    generation.status === "PROCESSING";
  const isFailed = generation.status === "FAILED";
  const isCompleted = generation.status === "COMPLETED";
  const canOpen = isCompleted || isFailed;

  return (
    <div
      className="group relative aspect-video cursor-pointer overflow-hidden rounded-xl border bg-card transition-all"
      onClick={() => {
        if (canOpen) onClick?.();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {imageUrl && isCompleted ? (
        <Image
          loader={cdnLoader}
          src={getCdnUrl(imageUrl)}
          alt={generation.prompt}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover"
        />
      ) : isInProgress ? (
        <div className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center">
          <Spinner />
          <span className="text-xs text-muted-foreground">
            {STATUS_LABELS[generation.status] ?? generation.status}
          </span>
        </div>
      ) : isFailed ? (
        <div className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center">
          <Warning className="size-6 text-destructive/70" />
          <p className="line-clamp-2 text-[11px] text-destructive/80">
            {generation.error || "Generation failed"}
          </p>
        </div>
      ) : (
        <div className="flex size-full items-center justify-center">
          <ImageSquare className="size-8 text-muted-foreground/30" />
        </div>
      )}

      {(isInProgress || isFailed) && (onDismiss || onDelete) && (
        <div
          className="absolute right-2 top-2 z-10 flex gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {isInProgress && onDismiss && (
            <button
              type="button"
              title="Hide from list"
              onClick={() => onDismiss(generation.id)}
              className="rounded-md bg-background/85 p-1.5 text-foreground transition-colors hover:bg-background"
            >
              <X className="size-3.5" weight="bold" />
            </button>
          )}
          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger
                type="button"
                className="rounded-md bg-destructive p-1.5 text-destructive-foreground transition-opacity hover:opacity-90"
              >
                <Trash className="size-3.5" weight="bold" />
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {isFailed ? "Delete failed thumbnail?" : "Cancel generation?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {isFailed
                      ? "This will permanently remove this failed generation."
                      : "This will stop tracking and remove the generation from your account."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => onDelete(generation.id)}
                  >
                    {isFailed ? "Delete" : "Remove"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      {isCompleted && imageUrl && hovered && (
        <div
          className="absolute inset-x-0 top-2 z-10 flex items-center justify-end gap-1.5 px-2"
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
              <AlertDialogTrigger
                type="button"
                className="rounded-md bg-destructive p-1.5 text-destructive-foreground transition-opacity hover:opacity-90"
              >
                <Trash className="size-4" />
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete thumbnail?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove this thumbnail. This action
                    cannot be undone.
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
    </div>
  );
}
