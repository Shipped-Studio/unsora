"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowSquareOut,
  CaretDown,
  DotsThree,
  Trash,
  VideoCamera,
  WarningCircle,
} from "@phosphor-icons/react";
import { friendlyGenerationError } from "@/components/generator/generation-error";
import {
  TILE_GHOST_BUTTON_CLASS,
  TILE_SKELETON_BAR_CLASS,
} from "@/components/generator/result-tile";
import { ToolGrid } from "@/components/generator/tool-layout";
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
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { getCaptionStyleLabel } from "@/constant/caption-styles";
import {
  getClipThumbnailUrl,
  isClippingActive,
  type AIClippingClip,
  type AIClippingJob,
} from "@/hooks/use-ai-clippings";
import { useYouTubeInfo } from "@/hooks/use-youtube-info";
import { timeAgo } from "@/lib/admin-format";
import { cn, getYouTubeVideoId } from "@/lib/utils";
import { getCdnUrl } from "@/lib/video-utils";
import { AIClippingClipCard } from "./ai-clipping-clip-card";
import { clipAspectClass, clipGridShape, formatClipRatio } from "./clip-ratio";

/** Short, readable name for the source; the URL itself is shown muted. */
function sourceTitle(url?: string | null, youTubeId?: string | null) {
  if (youTubeId) return "YouTube video";
  if (!url) return "Video";
  try {
    const file = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
    if (/\.(mp4|mov|webm|m4v|mkv)$/i.test(file)) return file;
  } catch {
    // Not a parseable URL; fall through.
  }
  return "Video link";
}

function displayUrl(url?: string | null) {
  return url ? url.replace(/^https?:\/\/(www\.)?/i, "") : null;
}

const PEEK_LIMIT = 4;

/**
 * Thumbnails of the first clips, shown on a collapsed job so its results are
 * visible without opening it.
 */
function ClipPeek({
  clips,
  ratio,
}: {
  clips: AIClippingClip[];
  ratio?: string | null;
}) {
  const thumbs = clips
    .map((clip) => ({ id: clip.id, url: getClipThumbnailUrl(clip) }))
    .filter((t): t is { id: string; url: string } => Boolean(t.url));
  if (thumbs.length === 0) return null;
  const extra = clips.length - Math.min(thumbs.length, PEEK_LIMIT);

  return (
    <span aria-hidden className="hidden shrink-0 items-center gap-1 sm:flex">
      {thumbs.slice(0, PEEK_LIMIT).map((thumb) => (
        <span
          key={thumb.id}
          className={cn(
            "h-11 overflow-hidden rounded-md bg-card",
            clipAspectClass(ratio),
          )}
        >
          <img
            src={getCdnUrl(thumb.url)}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        </span>
      ))}
      {extra > 0 ? (
        <span className="flex h-11 min-w-9 items-center justify-center rounded-md bg-card px-1.5 text-xs text-muted-foreground tabular-nums">
          +{extra}
        </span>
      ) : null}
    </span>
  );
}

function placeholderCount(job: AIClippingJob) {
  const limit = job.config?.limit;
  const clipCount = job.clips.length;
  if (typeof limit === "number" && limit > 0) {
    return Math.max(0, Math.min(limit - clipCount, 6));
  }
  return clipCount === 0 ? 3 : 0;
}

interface AIClippingJobGroupProps {
  job: AIClippingJob;
  defaultOpen?: boolean;
  onOpenClip: (clip: AIClippingClip, job: AIClippingJob) => void;
  onDeleteJob: (jobId: string) => void;
  onDeleteClip: (jobId: string, clipId: string) => void;
}

export function AIClippingJobGroup({
  job,
  defaultOpen = false,
  onOpenClip,
  onDeleteJob,
  onDeleteClip,
}: AIClippingJobGroupProps) {
  const active = isClippingActive(job.status);
  const failed = job.status === "FAILED";
  const [open, setOpen] = useState(defaultOpen || active);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const youTubeId = job.videoUrl ? getYouTubeVideoId(job.videoUrl) : null;
  const youTubeInfo = useYouTubeInfo(youTubeId);
  const title = youTubeInfo?.title ?? sourceTitle(job.videoUrl, youTubeId);
  const clipCount = job.clips.length;
  const placeholders = active ? placeholderCount(job) : 0;
  const query = job.config?.query;

  const progress = active
    ? clipCount > 0
      ? `${clipCount} ${clipCount === 1 ? "clip" : "clips"} so far`
      : query
        ? `Finding “${query}”`
        : "Finding clips"
    : failed
      ? "Failed"
      : clipCount > 0
        ? `${clipCount} ${clipCount === 1 ? "clip" : "clips"}`
        : "No clips found";

  const summary = [
    youTubeInfo?.author ?? (youTubeId ? null : displayUrl(job.videoUrl)),
    progress,
    !active && query ? `“${query}”` : null,
    job.config?.ratio ? formatClipRatio(job.config.ratio) : null,
    job.config?.enableCaption && job.config.captionStyle
      ? `${getCaptionStyleLabel(job.config.captionStyle)} captions`
      : null,
    timeAgo(job.createdAt),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="rounded-xl bg-muted">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2 p-3">
          <CollapsibleTrigger className="-m-1 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
            <span className="relative flex aspect-video w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-card sm:w-28">
              {youTubeId ? (
                <Image
                  src={`https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg`}
                  alt=""
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              ) : (
                <VideoCamera className="size-5 text-muted-foreground" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block truncate text-sm font-medium"
                title={job.videoUrl ?? undefined}
              >
                {title}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {summary}
              </span>
            </span>
            {!open ? <ClipPeek clips={job.clips} ratio={job.config?.ratio} /> : null}
            <CaretDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
            <span className="sr-only">{open ? "Hide clips" : "Show clips"}</span>
          </CollapsibleTrigger>

          {active ? (
            <Badge variant="secondary">
              <Spinner />
              {job.status === "QUEUED" ? "Queued" : "Processing"}
            </Badge>
          ) : failed ? (
            <Badge variant="destructive">Failed</Badge>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={TILE_GHOST_BUTTON_CLASS}
                  aria-label="More actions for this job"
                />
              }
            >
              <DotsThree weight="bold" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {job.videoUrl ? (
                <>
                  <DropdownMenuItem
                    render={
                      <a
                        href={job.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    <ArrowSquareOut />
                    Open source video
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash />
                Delete job
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {failed ? (
          <p
            role="alert"
            className="flex items-center gap-2 border-t border-card px-3 py-2 text-xs text-muted-foreground"
            title={job.error ?? undefined}
          >
            <WarningCircle className="size-4 shrink-0 text-destructive" />
            <span>
              <span className="font-medium text-foreground">Clipping failed.</span>{" "}
              {friendlyGenerationError(job.error, "file")}
            </span>
          </p>
        ) : null}

        <CollapsibleContent>
          <div className="border-t border-card p-3">
            {clipCount === 0 && placeholders === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {failed
                  ? "No clips were made from this video."
                  : "No clips matched. Try a different clip length or search."}
              </p>
            ) : (
              <ToolGrid shape={clipGridShape(job.config?.ratio)}>
                {job.clips.map((clip) => (
                  <AIClippingClipCard
                    key={clip.id}
                    clip={clip}
                    ratio={job.config?.ratio}
                    sourceUrl={job.videoUrl}
                    jobActive={active}
                    onOpen={() => onOpenClip(clip, job)}
                    onDelete={() => onDeleteClip(job.id, clip.id)}
                  />
                ))}
                {Array.from({ length: placeholders }).map((_, i) => (
                  <div
                    key={`placeholder-${i}`}
                    // White on the grey job group, like the clip cards.
                    className="overflow-hidden rounded-xl bg-card"
                    aria-hidden
                  >
                    <div
                      className={cn(
                        "flex items-center justify-center",
                        clipAspectClass(job.config?.ratio),
                      )}
                    >
                      <Spinner className="text-muted-foreground" />
                    </div>
                    <div className="space-y-2 p-3">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </ToolGrid>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              {clipCount > 0
                ? `The job and its ${clipCount} ${clipCount === 1 ? "clip" : "clips"} will be removed. This can't be undone.`
                : "The job will be removed. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                onDeleteJob(job.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export function JobGroupSkeleton() {
  return (
    <div className="space-y-3 rounded-xl bg-muted p-3">
      <div className="flex items-center gap-3">
        <Skeleton className={cn("aspect-video w-20 rounded-lg", TILE_SKELETON_BAR_CLASS)} />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className={cn("h-4 w-48 max-w-full", TILE_SKELETON_BAR_CLASS)} />
          <Skeleton className={cn("h-3 w-64 max-w-full", TILE_SKELETON_BAR_CLASS)} />
        </div>
      </div>
      <ToolGrid shape="video">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn("aspect-video rounded-xl", TILE_SKELETON_BAR_CLASS)}
          />
        ))}
      </ToolGrid>
    </div>
  );
}
