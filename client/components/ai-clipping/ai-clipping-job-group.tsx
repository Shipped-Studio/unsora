"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CaretDown, Trash } from "@phosphor-icons/react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { getYouTubeVideoId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import type { AIClippingClip, AIClippingJob } from "@/hooks/use-ai-clippings";
import { getCaptionStyleLabel } from "@/constant/caption-styles";
import { AIClippingClipCard } from "./ai-clipping-clip-card";
import { clipAspectClass, clipGridClass } from "./clip-ratio";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  QUEUED: {
    label: "Queued",
    className: "bg-muted text-muted-foreground",
  },
  PROCESSING: {
    label: "Processing",
    className: "bg-primary/10 text-primary",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-success/10 text-success",
  },
  FAILED: {
    label: "Failed",
    className: "bg-destructive/10 text-destructive",
  },
};

function formatRatioLabel(ratio: string) {
  const match = ratio.match(/^RATIO_(\d+)_(\d+)$/);
  return match ? `${match[1]}:${match[2]}` : ratio;
}

function formatVideoLabel(url?: string | null) {
  if (!url) return "Video";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return url.length > 48 ? `${url.slice(0, 48)}…` : url;
  }
}

function activePlaceholderCount(job: AIClippingJob) {
  const limit = job.config?.limit;
  const clipCount = job.clips.length;

  if (typeof limit === "number" && limit > 0) {
    return Math.max(0, limit - clipCount);
  }

  return clipCount === 0 ? 1 : 0;
}

interface AIClippingJobGroupProps {
  job: AIClippingJob;
  onPlayClip: (clip: AIClippingClip, job: AIClippingJob) => void;
  onDeleteJob: (jobId: string) => void;
  onDeleteClip: (jobId: string, clipId: string) => void;
}

export function AIClippingJobGroup({
  job,
  onPlayClip,
  onDeleteJob,
  onDeleteClip,
}: AIClippingJobGroupProps) {
  const status = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.QUEUED;
  const isActive = job.status === "QUEUED" || job.status === "PROCESSING";
  const youTubeId = job.videoUrl ? getYouTubeVideoId(job.videoUrl) : null;
  const clipCount = job.clips.length;

  const placeholders = isActive ? activePlaceholderCount(job) : 0;

  const [open, setOpen] = useState(isActive);

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="overflow-hidden rounded-2xl border bg-card shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/60">
            {youTubeId ? (
              <Image
                src={`https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg`}
                alt=""
                fill
                className="object-cover"
                sizes="56px"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
                Video
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {formatVideoLabel(job.videoUrl)}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {job.videoUrl}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {isActive
                ? clipCount > 0
                  ? `${clipCount} clip${clipCount === 1 ? "" : "s"} found so far`
                  : job.config?.query
                    ? `Searching for “${job.config.query}”…`
                    : "Analyzing video for viral clips…"
                : clipCount > 0
                  ? `${clipCount} clip${clipCount === 1 ? "" : "s"}`
                  : "No clips returned"}
              {!isActive && job.config?.query
                ? ` · Moments: “${job.config.query}”`
                : ""}
              {job.config?.ratio
                ? ` · ${formatRatioLabel(job.config.ratio)}`
                : ""}
              {job.config?.enableCaption && job.config.captionStyle
                ? ` · ${getCaptionStyleLabel(job.config.captionStyle)}`
                : ""}
            </p>
          </div>

          <CaretDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isActive && <Spinner className="size-4 text-primary" />}
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium",
              status.className,
            )}
          >
            {status.label}
          </span>
          <AlertDialog>
            <AlertDialogTrigger>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this clipping job?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the entire group and all {clipCount} clip
                  {clipCount === 1 ? "" : "s"} inside it. This action cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => onDeleteJob(job.id)}
                >
                  Delete group
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {job.error && job.status === "FAILED" && (
        <div className="border-b bg-destructive/5 px-4 py-2 text-xs text-destructive">
          {job.error}
        </div>
      )}

      <CollapsibleContent>
        <div className="p-4">
          {clipCount === 0 && !isActive ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No clips were generated for this video.
            </p>
          ) : (
            <div className={clipGridClass(job.config?.ratio)}>
              {job.clips.map((clip) => (
                <AIClippingClipCard
                  key={clip.id}
                  clip={clip}
                  ratio={job.config?.ratio}
                  jobProcessing={isActive}
                  onPlay={() => onPlayClip(clip, job)}
                  onDelete={() => onDeleteClip(job.id, clip.id)}
                />
              ))}

              {Array.from({ length: placeholders }).map((_, i) => (
                <div
                  key={`placeholder-${job.id}-${i}`}
                  className="overflow-hidden rounded-xl border border-dashed bg-card"
                >
                  <div
                    className={cn(
                      "flex flex-col items-center justify-center gap-2",
                      clipAspectClass(job.config?.ratio),
                    )}
                  >
                    <Spinner className="size-5 text-primary" />
                    <span className="text-[11px] text-muted-foreground">
                      Finding clips…
                    </span>
                  </div>
                  <div className="space-y-2 p-3">
                    <div className="h-3 w-2/3 rounded bg-secondary" />
                    <div className="h-2 w-1/3 rounded bg-secondary" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
