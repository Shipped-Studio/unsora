"use client";

import { useState } from "react";
import {
  DotsThree,
  DownloadSimple,
  Play,
  Trash,
  WarningCircle,
  X,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { VideoThumbnail } from "@/components/ui/video-thumbnail";
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
    <article className="flex flex-col overflow-hidden rounded-xl bg-muted">
      {videoUrl ? (
        <button
          type="button"
          onClick={() => onPlay(generation)}
          aria-label={`Play ${title}`}
          className="group relative block aspect-square w-full overflow-hidden bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          <VideoThumbnail videoUrl={getCdnUrl(videoUrl)} alt={title} />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-background/90 text-foreground shadow-xs transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
              <Play weight="fill" className="size-4" />
            </span>
          </span>
        </button>
      ) : (
        <div className="flex aspect-square flex-col items-center justify-center gap-2 bg-muted px-4 text-center">
          {failed ? (
            <>
              <WarningCircle className="size-5 text-destructive" />
              <p className="line-clamp-3 text-xs text-destructive">
                {generation.error || "Generation failed."}
              </p>
            </>
          ) : (
            <>
              <Spinner className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{status}</span>
            </>
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-medium" title={title}>
              {title}
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
          {onDelete && videoUrl ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="-mt-1 -mr-1"
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
          ) : onDismiss && (inProgress || failed) ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="-mt-1 -mr-1"
              onClick={() => onDismiss(generation.id)}
              aria-label="Dismiss"
            >
              <X />
            </Button>
          ) : null}
        </div>

        {videoUrl ? (
          <div className="mt-auto flex gap-2">
            <ScheduleLink url={videoUrl} mediaType="video" className="flex-1" />
            <a
              href={getCdnUrl(videoUrl, { download: true })}
              download
              className={buttonVariants({ variant: "outline", size: "icon-sm" })}
              aria-label="Download video"
            >
              <DownloadSimple />
            </a>
          </div>
        ) : failed && onDelete ? (
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
    <div className="overflow-hidden rounded-xl bg-muted">
      <Skeleton className="aspect-square rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}
