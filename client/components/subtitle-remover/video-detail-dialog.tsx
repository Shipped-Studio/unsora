"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Warning,
  DownloadSimple,
  Trash,
  Play,
  Pause,
  FileVideo,
} from "@phosphor-icons/react";
import { Spinner } from "@/components/ui/spinner";
import {
  ReactCompareSlider,
  ReactCompareSliderHandle,
} from "react-compare-slider";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { getCdnUrl } from "@/lib/video-utils";

interface ProcessedVideo {
  id: string;
  originalName: string;
  originalUrl: string;
  processedUrl?: string | null;
  status: string;
  error?: string | null;
  createdAt: string;
}

interface VideoDetailDialogProps {
  video: ProcessedVideo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (id: string) => void;
}

export function VideoDetailDialog({
  video,
  open,
  onOpenChange,
  onDelete,
}: VideoDetailDialogProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [playing, setPlaying] = useState(false);
  const originalRef = useRef<HTMLVideoElement>(null);
  const processedRef = useRef<HTMLVideoElement>(null);

  const isComplete = video?.status === "completed";
  const isFailed = video?.status === "failed";
  const isProcessing =
    video?.status === "queued" || video?.status === "processing";
  const outputUrl = video?.processedUrl;

  useEffect(() => {
    if (!open) {
      setPlaying(false);
      originalRef.current?.pause();
      processedRef.current?.pause();
    }
  }, [open]);

  const syncProcessedToOriginal = useCallback(() => {
    const orig = originalRef.current;
    const proc = processedRef.current;
    if (!orig || !proc) return;
    if (Math.abs(orig.currentTime - proc.currentTime) > 0.15) {
      proc.currentTime = orig.currentTime;
    }
  }, []);

  const togglePlay = useCallback(() => {
    const orig = originalRef.current;
    const proc = processedRef.current;
    if (!orig || !proc) return;

    if (orig.paused) {
      proc.currentTime = orig.currentTime;
      orig.play();
      proc.play();
      setPlaying(true);
    } else {
      orig.pause();
      proc.pause();
      setPlaying(false);
    }
  }, []);

  if (!video) return null;

  const createdDate = new Date(video.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[85vh] overflow-y-auto p-0 gap-0 bg-background border">
        <DialogTitle className="sr-only">
          Subtitle Removal — {video.originalName}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Compare original and processed video
        </DialogDescription>

        <div>
          {isComplete && outputUrl && video.originalUrl ? (
            <>
              <div className="bg-black">
              <ReactCompareSlider
                handle={
                  <ReactCompareSliderHandle
                    buttonStyle={{
                      backdropFilter: "none",
                      background: "white",
                      border: 0,
                      color: "#333",
                      maxHeight: "450px",
                    }}
                    linesStyle={{ opacity: 0.5 }}
                  />
                }
                itemOne={
                  <div className="flex items-center justify-center">
                    <video
                      ref={originalRef}
                      src={getCdnUrl(video.originalUrl)}
                      className="object-contain max-h-[450px]"
                      muted
                      playsInline
                      loop
                      onTimeUpdate={syncProcessedToOriginal}
                      onSeeked={syncProcessedToOriginal}
                    />
                    <span className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                      Original
                    </span>
                  </div>
                }
                itemTwo={
                  <div className="flex items-center justify-center">
                    <video
                      ref={processedRef}
                      src={getCdnUrl(outputUrl)}
                      className="object-contain max-h-[450px]"
                      muted
                      playsInline
                      loop
                    />
                    <span className="absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                      Processed
                    </span>
                  </div>
                }
              />
              </div>

              {/* Bottom bar */}
              <div className=" flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlay}
                    className="flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-secondary/80"
                  >
                    {playing ? (
                      <Pause className="size-3.5" weight="fill" />
                    ) : (
                      <Play className="size-3.5" weight="fill" />
                    )}
                    {playing ? "Pause" : "Play"}
                  </button>
                  <div className="hidden sm:flex flex-col">
                    <span className="text-xs font-medium text-foreground line-clamp-1 max-w-[300px]">
                      {video.originalName}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {createdDate}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {outputUrl && (
                    <a
                      href={getCdnUrl(outputUrl, { download: true })}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-secondary/80"
                    >
                      <DownloadSimple className="size-3.5" weight="bold" />
                      Download
                    </a>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-destructive"
                    >
                      <Trash className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : isFailed ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12">
              <Warning className="size-8 text-destructive" />
              <p className="text-sm text-destructive text-center">
                {video.error || "Processing failed"}
              </p>
            </div>
          ) : isProcessing ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <Spinner className="size-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Processing…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-12">
              <FileVideo className="size-8 text-muted-foreground" />
            </div>
          )}
        </div>
      </DialogContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete video?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this processed video. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onDelete?.(video.id);
                setConfirmDelete(false);
                onOpenChange(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
