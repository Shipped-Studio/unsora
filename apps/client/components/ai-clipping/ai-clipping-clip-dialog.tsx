"use client";

import { ArrowSquareOut, DownloadSimple, TrendUp } from "@phosphor-icons/react";
import { ScheduleLink } from "@/components/generator/tool-layout";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildSourceTimestampUrl,
  getClipThumbnailUrl,
  getClipVideoUrl,
  type AIClippingClip,
  type AIClippingJob,
} from "@/hooks/use-ai-clippings";
import { cn } from "@/lib/utils";
import { getCdnUrl } from "@/lib/video-utils";
import { clipTitle } from "./ai-clipping-clip-card";
import { formatClipTime, normalizeClipScore, parseClipRatio } from "./clip-ratio";

interface AIClippingClipDialogProps {
  selected: { clip: AIClippingClip; job: AIClippingJob } | null;
  onOpenChange: (open: boolean) => void;
}

export function AIClippingClipDialog({
  selected,
  onOpenChange,
}: AIClippingClipDialogProps) {
  const ratio = parseClipRatio(selected?.job.config?.ratio);
  const isVertical = ratio != null && ratio.h > ratio.w;

  return (
    <Dialog open={selected !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 overflow-hidden p-0",
          isVertical ? "sm:max-w-3xl" : "sm:max-w-4xl",
        )}
      >
        {selected ? <ClipDetails clip={selected.clip} job={selected.job} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ClipDetails({
  clip,
  job,
}: {
  clip: AIClippingClip;
  job: AIClippingJob;
}) {
  const title = clipTitle(clip);
  const videoUrl = getClipVideoUrl(clip);
  const thumbnailUrl = getClipThumbnailUrl(clip);
  const sourceUrl = buildSourceTimestampUrl(job.videoUrl, clip.startTime);
  const score = normalizeClipScore(clip.metadata?.score);
  const end =
    clip.endTime ??
    (clip.startTime != null && clip.duration != null
      ? clip.startTime + clip.duration
      : null);
  const range = [formatClipTime(clip.startTime), formatClipTime(end)]
    .filter(Boolean)
    .join(" to ");

  return (
    <div className="flex max-h-[85vh] flex-col sm:flex-row">
      <div className="flex min-h-0 flex-1 items-center justify-center bg-muted">
        {videoUrl ? (
          <video
            src={getCdnUrl(videoUrl)}
            className="max-h-[45vh] w-full object-contain sm:max-h-[85vh]"
            controls
            playsInline
            autoPlay
            preload="metadata"
          />
        ) : thumbnailUrl ? (
          <img
            src={getCdnUrl(thumbnailUrl)}
            alt={title}
            className="max-h-[45vh] w-full object-contain sm:max-h-[85vh]"
          />
        ) : (
          <p className="p-10 text-sm text-muted-foreground">No preview yet</p>
        )}
      </div>

      <div className="flex w-full flex-col gap-4 overflow-y-auto border-t p-5 sm:w-80 sm:shrink-0 sm:border-t-0 sm:border-l">
        <div className="space-y-2 pr-8">
          <DialogTitle className="leading-snug">{title}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
            {range ? <span>{range} in the source</span> : null}
            {score != null ? (
              <Badge variant="secondary" title="Virality score">
                <TrendUp />
                {score}
              </Badge>
            ) : null}
          </DialogDescription>
        </div>

        {clip.metadata?.desc ? (
          <p className="text-sm text-muted-foreground">{clip.metadata.desc}</p>
        ) : null}

        {clip.metadata?.tags && clip.metadata.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {clip.metadata.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                #{tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex flex-col gap-2 pt-2">
          {videoUrl ? (
            <>
              <ScheduleLink url={videoUrl} mediaType="video" variant="default" size="default" />
              <a
                href={getCdnUrl(videoUrl, { download: true })}
                download
                className={buttonVariants({ variant: "outline" })}
              >
                <DownloadSimple />
                Download
              </a>
            </>
          ) : null}
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "ghost" })}
            >
              <ArrowSquareOut />
              Open in source video
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
