"use client";

import { useState } from "react";
import {
  ArrowSquareOut,
  DotsThree,
  DownloadSimple,
  FilmStrip,
  Trash,
  TrendUp,
} from "@phosphor-icons/react";
import {
  FailedState,
  MEDIA_ICON_BUTTON_CLASS,
  PlayBadge,
  UnavailableState,
  useImageFade,
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
  // The moment is found (thumbnail) but the video is still being cut.
  const rendering = jobActive && !videoUrl && !failed && !preparing;
  const hasPreview = Boolean(thumbnailUrl || videoUrl);
  const momentUrl = buildSourceTimestampUrl(sourceUrl, clip.startTime);
  const fade = useImageFade(thumbnailUrl);

  const meta = preparing
    ? "Preparing"
    : rendering
      ? [duration, "Rendering video"].filter(Boolean).join(" · ")
      : failed
      ? "Failed"
      : [duration, start ? `from ${start}` : null].filter(Boolean).join(" · ");

  return (
    // White card: clip cards sit inside the grey job group.
    <article className="group relative flex flex-col overflow-hidden rounded-xl bg-card">
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
          {thumbnailUrl && fade.failed && !videoUrl ? (
            <UnavailableState />
          ) : thumbnailUrl && !fade.failed ? (
            <img
              src={getCdnUrl(thumbnailUrl)}
              alt={title}
              loading="lazy"
              onLoad={fade.onLoad}
              onError={fade.onError}
              className={cn("size-full object-cover", fade.className)}
            />
          ) : (
            <VideoThumbnail videoUrl={getCdnUrl(videoUrl!)} alt={title} />
          )}
          {videoUrl ? (
            <PlayBadge />
          ) : rendering ? (
            <Badge
              variant="secondary"
              className="absolute bottom-2 left-2"
              title="The clip is found and its video is being made"
            >
              <Spinner />
              Rendering
            </Badge>
          ) : null}
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
      ) : failed ? (
        <div className={cn("bg-muted", clipAspectClass(ratio))}>
          <FailedState error={clip.error} kind="file" title="Clip failed" />
        </div>
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
          ) : (
            <FilmStrip className="size-6 text-muted-foreground" />
          )}
        </div>
      )}

      {!preparing ? (
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={MEDIA_ICON_BUTTON_CLASS}
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
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-medium" title={title}>
            {title}
          </p>
          <p className="truncate text-xs text-muted-foreground tabular-nums">
            {meta}
          </p>
        </div>

        {videoUrl ? (
          <div className="mt-auto flex items-center gap-1">
            <ScheduleLink url={videoUrl} mediaType="video" size="xs" variant="secondary" />
            <a
              href={getCdnUrl(videoUrl, { download: true })}
              download
              className={buttonVariants({ variant: "ghost", size: "icon-xs" })}
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
