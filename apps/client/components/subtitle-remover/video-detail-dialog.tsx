"use client";

import { useCallback, useRef, useState } from "react";
import { DownloadSimple, Pause, Play } from "@phosphor-icons/react";
import { ReactCompareSlider } from "react-compare-slider";
import { ScheduleLink } from "@/components/generator/tool-layout";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { VideoJob } from "@/hooks/use-video-jobs";
import { getCdnUrl } from "@/lib/video-utils";

interface VideoCompareDialogProps {
  job: VideoJob | null;
  onOpenChange: (open: boolean) => void;
  /** Label on the processed side, e.g. "Upscaled". */
  processedLabel: string;
  /** Extra detail next to the date, e.g. the model. */
  detail?: string | null;
}

/** Side-by-side slider comparing a job's original and processed video. */
export function VideoCompareDialog({
  job,
  onOpenChange,
  processedLabel,
  detail,
}: VideoCompareDialogProps) {
  return (
    <Dialog open={job !== null} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-4xl">
        {job ? (
          <CompareBody job={job} processedLabel={processedLabel} detail={detail} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CompareBody({
  job,
  processedLabel,
  detail,
}: {
  job: VideoJob;
  processedLabel: string;
  detail?: string | null;
}) {
  const [playing, setPlaying] = useState(false);
  const originalRef = useRef<HTMLVideoElement>(null);
  const processedRef = useRef<HTMLVideoElement>(null);

  const syncProcessedToOriginal = useCallback(() => {
    const original = originalRef.current;
    const processed = processedRef.current;
    if (!original || !processed) return;
    if (Math.abs(original.currentTime - processed.currentTime) > 0.15) {
      processed.currentTime = original.currentTime;
    }
  }, []);

  const togglePlay = useCallback(() => {
    const original = originalRef.current;
    const processed = processedRef.current;
    if (!original || !processed) return;

    if (original.paused) {
      processed.currentTime = original.currentTime;
      Promise.all([original.play(), processed.play()])
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      original.pause();
      processed.pause();
      setPlaying(false);
    }
  }, []);

  const createdDate = new Date(job.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const outputUrl = job.processedUrl;

  return (
    <>
      <DialogHeader className="p-4 pr-12">
        <DialogTitle className="truncate">{job.originalName}</DialogTitle>
        <DialogDescription>
          {[detail, createdDate].filter(Boolean).join(" · ")}
        </DialogDescription>
      </DialogHeader>

      {outputUrl && job.originalUrl ? (
        <div className="border-y bg-muted">
          <ReactCompareSlider
            itemOne={
              <div className="relative flex items-center justify-center">
                <video
                  ref={originalRef}
                  src={getCdnUrl(job.originalUrl)}
                  className="max-h-[60vh] object-contain"
                  muted
                  playsInline
                  loop
                  onTimeUpdate={syncProcessedToOriginal}
                  onSeeked={syncProcessedToOriginal}
                />
                <Badge variant="secondary" className="absolute top-3 left-3">
                  Original
                </Badge>
              </div>
            }
            itemTwo={
              <div className="relative flex items-center justify-center">
                <video
                  ref={processedRef}
                  src={getCdnUrl(outputUrl)}
                  className="max-h-[60vh] object-contain"
                  muted
                  playsInline
                  loop
                />
                <Badge variant="secondary" className="absolute top-3 right-3">
                  {processedLabel}
                </Badge>
              </div>
            }
          />
        </div>
      ) : outputUrl ? (
        <div className="border-y bg-muted">
          <video
            src={getCdnUrl(outputUrl)}
            className="mx-auto max-h-[60vh] object-contain"
            controls
            playsInline
          />
        </div>
      ) : null}

      <DialogFooter className="flex-row flex-wrap items-center p-4 sm:justify-between">
        {job.originalUrl ? (
          <Button variant="outline" size="sm" onClick={togglePlay}>
            {playing ? <Pause weight="fill" /> : <Play weight="fill" />}
            {playing ? "Pause" : "Play both"}
          </Button>
        ) : (
          <span />
        )}
        {outputUrl ? (
          <div className="flex gap-2">
            <a
              href={getCdnUrl(outputUrl, { download: true })}
              download
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <DownloadSimple />
              Download
            </a>
            <ScheduleLink url={outputUrl} mediaType="video" variant="default" />
          </div>
        ) : null}
      </DialogFooter>
    </>
  );
}
