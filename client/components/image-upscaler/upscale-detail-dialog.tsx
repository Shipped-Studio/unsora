"use client";

import { useState } from "react";
import { Warning, DownloadSimple, Trash, ImageSquare } from "@phosphor-icons/react";
import Image from "next/image";
import { Spinner } from "@/components/ui/spinner";
import {
  ReactCompareSlider,
  ReactCompareSliderHandle,
  ReactCompareSliderImage,
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

const cdnLoader = ({ src }: { src: string }) => src;

export interface UpscaleDetailData {
  id: string;
  originalName?: string;
  inputUrl?: string | null;
  outputUrl?: string | null;
  status: string;
  error?: string | null;
  createdAt: string;
}

interface UpscaleDetailDialogProps {
  job: UpscaleDetailData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (id: string) => void;
}

export function UpscaleDetailDialog({
  job,
  open,
  onOpenChange,
  onDelete,
}: UpscaleDetailDialogProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isComplete = job?.status === "COMPLETED";
  const isFailed = job?.status === "FAILED";
  const isProcessing =
    job?.status === "QUEUED" || job?.status === "PROCESSING";

  if (!job) return null;

  const createdDate = new Date(job.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const outputUrl = job.outputUrl ? getCdnUrl(job.outputUrl) : null;
  const inputUrl = job.inputUrl ? getCdnUrl(job.inputUrl) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[85vh] p-0 gap-0 bg-background border overflow-y-auto">
        <DialogTitle className="sr-only">
          Image Upscaler — {job.originalName}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Compare original and upscaled image
        </DialogDescription>

        <div className="flex flex-col">
          {isComplete && outputUrl && inputUrl ? (
            <>
              {/* Before/After slider */}
              <div className="relative overflow-hidden bg-black">
                <ReactCompareSlider
                  handle={
                    <ReactCompareSliderHandle
                      buttonStyle={{
                        backdropFilter: "none",
                        background: "white",
                        border: 0,
                        color: "#333",
                      }}
                      linesStyle={{ opacity: 0.5 }}
                    />
                  }
                  itemOne={
                    <div className="relative">
                      <ReactCompareSliderImage
                        src={inputUrl}
                        alt="Original"
                        style={{ maxHeight: "65vh", objectFit: "contain" }}
                      />
                      <span className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                        Original
                      </span>
                    </div>
                  }
                  itemTwo={
                    <div className="relative">
                      <ReactCompareSliderImage
                        src={outputUrl}
                        alt="Upscaled"
                        style={{ maxHeight: "65vh", objectFit: "contain" }}
                      />
                      <span className="absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                        Upscaled
                      </span>
                    </div>
                  }
                />
              </div>

              {/* Bottom bar */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-foreground line-clamp-1 max-w-[300px]">
                    {job.originalName}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{createdDate}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <a
                    href={outputUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80"
                  >
                    <DownloadSimple className="size-3.5" weight="bold" />
                    Download
                  </a>
                  {onDelete && (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : isComplete && outputUrl ? (
            <div className="flex flex-col">
              <div className="relative flex items-center justify-center bg-black">
                <Image
                  loader={cdnLoader}
                  src={outputUrl}
                  alt={job.originalName || "Upscaled image"}
                  width={800}
                  height={600}
                  className="max-h-[65vh] w-auto object-contain"
                />
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-medium text-foreground">
                  {job.originalName}
                </span>
                <a
                  href={outputUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80"
                >
                  <DownloadSimple className="size-3.5" weight="bold" />
                  Download
                </a>
              </div>
            </div>
          ) : isFailed ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16">
              <Warning className="size-8 text-destructive" />
              <p className="text-sm text-destructive/80 text-center">
                {job.error || "Upscaling failed"}
              </p>
            </div>
          ) : isProcessing ? (
            <div className="flex flex-col items-center gap-2 py-16">
              <Spinner className="size-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Processing…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-16">
              <ImageSquare className="size-8 text-muted-foreground/30" />
            </div>
          )}
        </div>
      </DialogContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete image?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this upscaled image. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onDelete?.(job.id);
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
