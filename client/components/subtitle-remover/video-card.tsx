"use client";

import { useState } from "react";
import {
  ArrowsLeftRight,
  DotsThree,
  DownloadSimple,
  FileVideo,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
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
    <article className="flex flex-col overflow-hidden rounded-xl bg-muted">
      {outputUrl ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Compare ${job.originalName}`}
          className="relative block aspect-video w-full overflow-hidden bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          <VideoThumbnail
            videoUrl={getCdnUrl(outputUrl)}
            alt={job.originalName}
            seekTo={0.5}
          />
        </button>
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-muted px-4 text-center">
          {active ? (
            <>
              <Spinner className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{status}</span>
            </>
          ) : failed ? (
            <>
              <WarningCircle className="size-5 text-destructive" />
              <p className="line-clamp-3 text-xs text-destructive">
                {job.error || "Processing failed."}
              </p>
            </>
          ) : (
            <FileVideo className="size-6 text-muted-foreground" />
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={job.originalName}>
              {job.originalName}
            </p>
            <p
              className={
                failed
                  ? "truncate text-xs text-destructive"
                  : "truncate text-xs text-muted-foreground"
              }
            >
              {status}
            </p>
          </div>
          {outputUrl ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="-mt-1 -mr-1"
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
          ) : null}
        </div>

        {outputUrl ? (
          <div className="mt-auto flex gap-2">
            <ScheduleLink url={outputUrl} mediaType="video" className="flex-1" />
            <a
              href={getCdnUrl(outputUrl, { download: true })}
              download
              className={buttonVariants({ variant: "outline", size: "icon-sm" })}
              aria-label={`Download ${job.originalName}`}
            >
              <DownloadSimple />
            </a>
          </div>
        ) : failed ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-auto"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash />
            Delete
          </Button>
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
    <div className="overflow-hidden rounded-xl bg-muted">
      <Skeleton className="aspect-video rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}
