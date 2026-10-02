"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { ArrowSquareOut, DownloadSimple, TrendUp } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCdnUrl } from "@/lib/video-utils";
import {
  buildSourceTimestampUrl,
  getClipThumbnailUrl,
  getClipVideoUrl,
  type AIClippingClip,
  type AIClippingJob,
} from "@/hooks/use-ai-clippings";
import { normalizeClipScore, parseClipRatio } from "./clip-ratio";

const cdnLoader = ({ src }: { src: string }) => src;

function formatTimestamp(seconds?: number | null) {
  if (seconds == null || Number.isNaN(seconds)) return null;
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface AIClippingClipDialogProps {
  clip: AIClippingClip | null;
  job: AIClippingJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIClippingClipDialog({
  clip,
  job,
  open,
  onOpenChange,
}: AIClippingClipDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoUrl = clip ? getClipVideoUrl(clip) : null;
  const thumbnailUrl = clip ? getClipThumbnailUrl(clip) : null;
  const sourceUrl = job?.videoUrl
    ? buildSourceTimestampUrl(job.videoUrl, clip?.startTime)
    : null;
  const ratio = parseClipRatio(job?.config?.ratio);
  const isVertical = ratio != null && ratio.h > ratio.w;
  const score = normalizeClipScore(clip?.metadata?.score);

  useEffect(() => {
    if (!open) {
      videoRef.current?.pause();
    }
  }, [open]);

  if (!clip) return null;

  const title = clip.title || `Clip ${clip.order + 1}`;
  const timeRange = [
    formatTimestamp(clip.startTime),
    clip.duration != null
      ? formatTimestamp(clip.endTime ?? clip.startTime! + clip.duration)
      : null,
  ]
    .filter(Boolean)
    .join(" – ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 overflow-hidden p-0",
          isVertical ? "sm:max-w-3xl" : "sm:max-w-4xl",
        )}
      >
        <div className="flex max-h-[85vh] flex-col sm:flex-row">
          <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={getCdnUrl(videoUrl)}
                className="max-h-[40vh] w-full object-contain sm:max-h-[85vh]"
                controls
                playsInline
                autoPlay
                preload="metadata"
              />
            ) : thumbnailUrl ? (
              <div className="relative max-h-[40vh] w-full sm:max-h-[85vh]">
                <Image
                  loader={cdnLoader}
                  src={getCdnUrl(thumbnailUrl)}
                  alt={title}
                  width={ratio ? ratio.w * 100 : 1280}
                  height={ratio ? ratio.h * 100 : 720}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex aspect-video w-full items-center justify-center text-sm text-muted-foreground">
                No preview available
              </div>
            )}
          </div>

          <div className="flex w-full flex-col gap-4 overflow-y-auto bg-card p-5 sm:w-80 sm:shrink-0">
            <div className="space-y-1.5">
              <DialogTitle className="text-base leading-snug">
                {title}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
                {timeRange && <span>{timeRange}</span>}
                {score != null && (
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                      score >= 80
                        ? "bg-success/15 text-success"
                        : score >= 60
                          ? "bg-warning/15 text-warning"
                          : "bg-secondary text-foreground",
                    )}
                    title="Virality score"
                  >
                    <TrendUp className="size-3" weight="bold" />
                    {score}
                  </span>
                )}
              </DialogDescription>
            </div>

            {clip.metadata?.desc && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {clip.metadata.desc}
              </p>
            )}

            {clip.metadata?.tags && clip.metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {clip.metadata.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-auto flex flex-col gap-2 pt-2">
              {videoUrl && (
                <Button
                  render={
                    <a
                      href={getCdnUrl(videoUrl, { download: true })}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <DownloadSimple className="size-4" />
                  Download clip
                </Button>
              )}
              {sourceUrl && (
                <Button
                  variant="outline"
                  render={
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <ArrowSquareOut className="size-4" />
                  Open moment in source
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
