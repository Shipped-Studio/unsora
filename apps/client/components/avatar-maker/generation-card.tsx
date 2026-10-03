"use client";

import { useState } from "react";
import {
  DotsThree,
  DownloadSimple,
  Trash,
  X,
} from "@phosphor-icons/react";
import {
  FailedState,
  MEDIA_ICON_BUTTON_CLASS,
  TILE_GHOST_BUTTON_CLASS,
  PlayBadge,
  TILE_CLASS,
  TILE_SKELETON_BAR_CLASS,
  TILE_SKELETON_CLASS,
} from "@/components/generator/result-tile";
import { ScheduleLink } from "@/components/generator/tool-layout";
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
import { VideoThumbnail } from "@/components/ui/video-thumbnail";
import { cn } from "@/lib/utils";
import { getCdnUrl } from "@/lib/video-utils";

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
  onPlay: (generation: AvatarCardData) => void;
  /** Deletes a saved video (asks first). */
  onDelete?: (id: string) => void;
  /** Hides a video that's still starting or failed to start. */
  onDismiss?: (id: string) => void;
}

export function AvatarGenerationCard({
  generation,
  onPlay,
  onDelete,
  onDismiss,
}: AvatarGenerationCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const videoUrl =
    generation.status === "COMPLETED" ? generation.outputUrl : null;
  const inProgress =
    generation.status === "submitting" ||
    generation.status === "QUEUED" ||
    generation.status === "PROCESSING";
  const failed = generation.status === "FAILED";
  const title = generation.transcript || "Avatar video";

  const status = inProgress
    ? generation.status === "QUEUED"
      ? "Queued"
      : generation.status === "submitting"
        ? "Starting"
        : "Generating"
    : failed
      ? "Failed"
      : [
          generation.emotion
            ? generation.emotion.charAt(0).toUpperCase() +
              generation.emotion.slice(1)
            : null,
          generation.createdAt
            ? new Date(generation.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <article className={cn("group relative flex flex-col", TILE_CLASS)}>
      {videoUrl ? (
        <button
          type="button"
          onClick={() => onPlay(generation)}
          aria-label={`Play ${title}`}
          className="relative block aspect-square w-full overflow-hidden bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          <VideoThumbnail
            videoUrl={getCdnUrl(videoUrl)}
            alt={title}
            className="bg-card"
          />
          <PlayBadge />
        </button>
      ) : failed ? (
        <div className="aspect-square bg-card">
          <FailedState error={generation.error} />
        </div>
      ) : (
        <div className="flex aspect-square flex-col items-center justify-center gap-2 bg-card px-4 text-center">
          <Spinner className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{status}</span>
        </div>
      )}

      {onDelete && videoUrl ? (
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={MEDIA_ICON_BUTTON_CLASS}
                  aria-label="More actions"
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
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={title}>
              {title}
            </p>
            <p className="truncate text-xs text-muted-foreground">{status}</p>
          </div>
          {onDismiss && (inProgress || failed) ? (
            <Button
              variant="ghost"
              size="icon-xs"
              className={cn("-mt-0.5 -mr-1", TILE_GHOST_BUTTON_CLASS)}
              onClick={() => onDismiss(generation.id)}
              aria-label="Dismiss"
            >
              <X />
            </Button>
          ) : null}
        </div>

        {videoUrl ? (
          <div className="mt-auto flex items-center gap-1">
            <ScheduleLink url={videoUrl} mediaType="video" size="xs" variant="outline" />
            <a
              href={getCdnUrl(videoUrl, { download: true })}
              download
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-xs" }),
                TILE_GHOST_BUTTON_CLASS,
              )}
              aria-label="Download video"
            >
              <DownloadSimple />
            </a>
          </div>
        ) : failed && onDelete ? (
          <div className="mt-auto flex">
            <Button variant="outline" size="xs" onClick={() => setConfirmOpen(true)}>
              <Trash />
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      {onDelete ? (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this video?</AlertDialogTitle>
              <AlertDialogDescription>
                The avatar video will be removed from your results. This
                can&apos;t be undone.
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

export function AvatarCardSkeleton() {
  return (
    <div className={TILE_SKELETON_CLASS}>
      <Skeleton className={cn("aspect-square rounded-none", TILE_SKELETON_BAR_CLASS)} />
      <div className="space-y-2 p-3">
        <Skeleton className={cn("h-4 w-3/4", TILE_SKELETON_BAR_CLASS)} />
        <Skeleton className={cn("h-3 w-1/3", TILE_SKELETON_BAR_CLASS)} />
        <Skeleton className={cn("h-7 w-24", TILE_SKELETON_BAR_CLASS)} />
      </div>
    </div>
  );
}
