"use client";

import { DownloadSimple } from "@phosphor-icons/react";
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
} from "react-compare-slider";
import { ScheduleLink } from "@/components/generator/tool-layout";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImageUpscale } from "@/hooks/use-image-upscales-query";
import { getCdnUrl } from "@/lib/video-utils";

/**
 * Media height cap: 60vh on tall screens, and on short ones whatever is left
 * after the header and footer (~14rem with stacked buttons), so Download and
 * Schedule stay on screen.
 */
const MEDIA_MAX_HEIGHT = "max(12rem, min(60vh, calc(100dvh - 14rem)))";

interface UpscaleDetailDialogProps {
  job: ImageUpscale | null;
  name: string;
  onOpenChange: (open: boolean) => void;
}

/** Before/after slider for a finished image upscale. */
export function UpscaleDetailDialog({
  job,
  name,
  onOpenChange,
}: UpscaleDetailDialogProps) {
  const outputUrl = job?.outputUrl ? getCdnUrl(job.outputUrl) : null;
  const inputUrl = job?.inputUrl ? getCdnUrl(job.inputUrl) : null;

  return (
    <Dialog open={job !== null} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-4xl">
        {job ? (
          <>
            <DialogHeader className="p-4 pr-12">
              <DialogTitle className="truncate">{name}</DialogTitle>
              <DialogDescription>
                {new Date(job.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="border-y bg-muted">
              {outputUrl && inputUrl ? (
                <ReactCompareSlider
                  itemOne={
                    <div className="relative">
                      <ReactCompareSliderImage
                        src={inputUrl}
                        alt="Original"
                        style={{ maxHeight: MEDIA_MAX_HEIGHT, objectFit: "contain" }}
                      />
                      <Badge variant="secondary" className="absolute top-3 left-3">
                        Original
                      </Badge>
                    </div>
                  }
                  itemTwo={
                    <div className="relative">
                      <ReactCompareSliderImage
                        src={outputUrl}
                        alt="Upscaled"
                        style={{ maxHeight: MEDIA_MAX_HEIGHT, objectFit: "contain" }}
                      />
                      <Badge
                        variant="secondary"
                        className="absolute top-3 right-3"
                      >
                        Upscaled
                      </Badge>
                    </div>
                  }
                />
              ) : outputUrl ? (
                <img
                  src={outputUrl}
                  alt={name}
                  style={{ maxHeight: MEDIA_MAX_HEIGHT }}
                  className="mx-auto object-contain"
                />
              ) : null}
            </div>

            {job.outputUrl ? (
              <DialogFooter className="p-4">
                <a
                  href={getCdnUrl(job.outputUrl, { download: true })}
                  download
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <DownloadSimple />
                  Download
                </a>
                <ScheduleLink
                  url={job.outputUrl}
                  mediaType="image"
                  variant="default"
                />
              </DialogFooter>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
