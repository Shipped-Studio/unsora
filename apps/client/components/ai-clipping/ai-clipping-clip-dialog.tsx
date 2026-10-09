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
import { Spinner } from "@/components/ui/spinner";
import {
  buildSourceTimestampUrl,
  getClipThumbnailUrl,
  getClipVideoUrl,
  isClippingActive,
  type AIClippingClip,
  type AIClippingJob,
} from "@/hooks/use-ai-clippings";
import { cn, getYouTubeVideoId } from "@/lib/utils";
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
  const rendering =
    !videoUrl && clip.status !== "FAILED" && isClippingActive(job.status);
  const youTubeId = job.videoUrl ? getYouTubeVideoId(job.videoUrl) : null;
  // Until the clip is rendered, play the same moment from the source video.
  const sourceEmbed =
    !videoUrl && youTubeId && clip.startTime != null
      ? `https://www.youtube-nocookie.com/embed/${youTubeId}?autoplay=1&rel=0&start=${Math.floor(clip.startTime)}${end != null ? `&end=${Math.ceil(end)}` : ""}`
      : null;

  return (
    <div className="flex max-h-[85vh] flex-col sm:flex-row">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-muted">
        {!videoUrl && (rendering || sourceEmbed) ? (
          <p className="flex w-full items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
            {rendering ? <Spinner className="shrink-0" /> : null}
            {rendering && sourceEmbed
              ? "Your clip is still rendering. Here's the moment from the original video."
              : rendering
                ? "Your clip is still rendering. It will play here when it's ready."
                : "Here's the moment from the original video."}
          </p>
        ) : null}
        {videoUrl ? (
          <video
            src={getCdnUrl(videoUrl)}
            className="max-h-[45vh] w-full object-contain sm:max-h-[85vh]"
            controls
            playsInline
            autoPlay
            preload="metadata"
          />
        ) : sourceEmbed ? (
          <div className="relative aspect-video w-full">
            <iframe
              src={sourceEmbed}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 size-full"
            />
          </div>
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
