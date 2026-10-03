"use client";

import { useState } from "react";
import {
  ArrowsLeftRight,
  DotsThree,
  DownloadSimple,
  FileVideo,
  Trash,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { VideoThumbnail } from "@/components/ui/video-thumbnail";
import { isVideoJobActive, type VideoJob } from "@/hooks/use-video-jobs";
import { cn } from "@/lib/utils";
import { getCdnUrl } from "@/lib/video-utils";

interface VideoJobCardProps {
  job: VideoJob;
  /** Status line while the job runs, e.g. "Upscaling". */
  activeLabel: string;
  /** Extra detail for finished jobs, e.g. the model. */
  detail?: string | null;
  onOpen: () => void;
  onDelete: () => void;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Result card for the video upscaler and subtitle remover. */
export function VideoJobCard({
  job,
  activeLabel,
  detail,
  onOpen,
  onDelete,
}: VideoJobCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const active = isVideoJobActive(job);
  const failed = job.status === "failed";
  const outputUrl = job.status === "completed" ? job.processedUrl : null;

  const status = active
    ? job.status === "queued"
      ? "Queued"
      : activeLabel
    : failed
      ? "Failed"
      : [detail, formatDate(job.createdAt)].filter(Boolean).join(" · ");

  return (
    <article className={cn("group relative flex flex-col", TILE_CLASS)}>
      {outputUrl ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Compare ${job.originalName}`}
          className="relative block aspect-video w-full overflow-hidden bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          <VideoThumbnail
            videoUrl={getCdnUrl(outputUrl)}
            alt={job.originalName}
            seekTo={0.5}
            className="bg-card"
          />
          <PlayBadge />
        </button>
      ) : failed ? (
        <div className="aspect-video bg-card">
          <FailedState error={job.error} kind="file" title="Processing failed" />
        </div>
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-card px-4 text-center">
          {active ? (
            <>
              <Spinner className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{status}</span>
            </>
          ) : (
            <FileVideo className="size-6 text-muted-foreground" />
          )}
        </div>
      )}

      {outputUrl ? (
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={MEDIA_ICON_BUTTON_CLASS}
                  aria-label={`More actions for ${job.originalName}`}
                />
              }
            >
              <DotsThree weight="bold" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={onOpen}>
                <ArrowsLeftRight />
                Compare
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={job.originalName}>
            {job.originalName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{status}</p>
        </div>

        {outputUrl ? (
          <div className="mt-auto flex items-center gap-1">
            <ScheduleLink url={outputUrl} mediaType="video" size="xs" variant="outline" />
            <a
              href={getCdnUrl(outputUrl, { download: true })}
              download
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-xs" }),
                TILE_GHOST_BUTTON_CLASS,
              )}
              aria-label={`Download ${job.originalName}`}
            >
              <DownloadSimple />
            </a>
          </div>
        ) : failed ? (
          <div className="mt-auto flex">
            <Button variant="outline" size="xs" onClick={() => setConfirmOpen(true)}>
              <Trash />
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this video?</AlertDialogTitle>
            <AlertDialogDescription>
              {job.originalName} will be removed from your results. This
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                onDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

export function VideoJobCardSkeleton() {
  return (
    <div className={TILE_SKELETON_CLASS}>
      <Skeleton className={cn("aspect-video rounded-none", TILE_SKELETON_BAR_CLASS)} />
      <div className="space-y-2 p-3">
        <Skeleton className={cn("h-4 w-2/3", TILE_SKELETON_BAR_CLASS)} />
        <Skeleton className={cn("h-3 w-1/3", TILE_SKELETON_BAR_CLASS)} />
        <Skeleton className={cn("h-7 w-24", TILE_SKELETON_BAR_CLASS)} />
      </div>
    </div>
  );
}
