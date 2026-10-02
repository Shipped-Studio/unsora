"use client";

import { useState } from "react";
import {
  ArrowSquareOut,
  DotsThree,
  DownloadSimple,
  FilmStrip,
  Trash,
  TrendUp,
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
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { VideoThumbnail } from "@/components/ui/video-thumbnail";
import {
  buildSourceTimestampUrl,
  getClipThumbnailUrl,
  getClipVideoUrl,
  type AIClippingClip,
} from "@/hooks/use-ai-clippings";
import { cn } from "@/lib/utils";
import { getCdnUrl } from "@/lib/video-utils";
import {
  clipAspectClass,
  formatClipTime,
  normalizeClipScore,
} from "./clip-ratio";

interface AIClippingClipCardProps {
  clip: AIClippingClip;
  ratio?: string | null;
  sourceUrl?: string | null;
  /** The job is still running, so an empty clip is being prepared. */
  jobActive: boolean;
  onOpen: () => void;
  onDelete: () => void;
}

export function clipTitle(clip: AIClippingClip) {
  return clip.title || `Clip ${clip.order + 1}`;
}

export function AIClippingClipCard({
  clip,
  ratio,
  sourceUrl,
  jobActive,
  onOpen,
  onDelete,
}: AIClippingClipCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const title = clipTitle(clip);
  const thumbnailUrl = getClipThumbnailUrl(clip);
  const videoUrl = getClipVideoUrl(clip);
  const score = normalizeClipScore(clip.metadata?.score);
  const duration = formatClipTime(clip.duration);
  const start = formatClipTime(clip.startTime);
  const failed = clip.status === "FAILED";
  const preparing = jobActive && !thumbnailUrl && !videoUrl && !failed;
  const hasPreview = Boolean(thumbnailUrl || videoUrl);
  const momentUrl = buildSourceTimestampUrl(sourceUrl, clip.startTime);

  const meta = preparing
    ? "Preparing"
    : failed
      ? "Failed"
      : [duration, start ? `from ${start}` : null].filter(Boolean).join(" · ");

  return (
    <article className="flex flex-col overflow-hidden rounded-xl bg-muted">
      {hasPreview ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${title}`}
          className={cn(
            "relative block w-full overflow-hidden bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
            clipAspectClass(ratio),
          )}
        >
          {thumbnailUrl ? (
            <img
              src={getCdnUrl(thumbnailUrl)}
              alt={title}
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <VideoThumbnail videoUrl={getCdnUrl(videoUrl!)} alt={title} />
          )}
          {score != null ? (
            <Badge
              variant="secondary"
              className="absolute top-2 left-2 tabular-nums"
              title="Virality score"
            >
              <TrendUp />
              {score}
            </Badge>
          ) : null}
          {duration ? (
            <Badge
              variant="secondary"
              className="absolute right-2 bottom-2 tabular-nums"
            >
              {duration}
            </Badge>
          ) : null}
        </button>
      ) : (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-2 bg-muted px-3 text-center",
            clipAspectClass(ratio),
          )}
        >
          {preparing ? (
            <>
              <Spinner className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Preparing</span>
            </>
          ) : failed ? (
            <>
              <WarningCircle className="size-5 text-destructive" />
              <p className="line-clamp-3 text-xs text-destructive">
                {clip.error || "This clip failed."}
              </p>
            </>
          ) : (
            <FilmStrip className="size-6 text-muted-foreground" />
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
              className={cn(
                "truncate text-xs tabular-nums",
                failed ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {meta}
            </p>
          </div>
          {!preparing ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="-mt-1 -mr-1"
                    aria-label={`More actions for ${title}`}
                  />
                }
              >
                <DotsThree weight="bold" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {momentUrl ? (
                  <DropdownMenuItem
                    render={
                      <a href={momentUrl} target="_blank" rel="noopener noreferrer" />
                    }
                  >
                    <ArrowSquareOut />
                    Open in source video
                  </DropdownMenuItem>
                ) : null}
                {momentUrl ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmOpen(true)}
                >
                  <Trash />
                  Delete clip
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {videoUrl ? (
          <div className="mt-auto flex gap-2">
            <ScheduleLink url={videoUrl} mediaType="video" className="flex-1" />
            <a
              href={getCdnUrl(videoUrl, { download: true })}
              download
              className={buttonVariants({ variant: "outline", size: "icon-sm" })}
              aria-label={`Download ${title}`}
            >
              <DownloadSimple />
            </a>
          </div>
        ) : null}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this clip?</AlertDialogTitle>
            <AlertDialogDescription>
              {title} will be removed from this job. This can&apos;t be undone.
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
