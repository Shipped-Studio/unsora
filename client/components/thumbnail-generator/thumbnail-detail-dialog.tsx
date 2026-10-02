"use client";

import { useState, useCallback } from "react";
import {
  Warning,
  DownloadSimple,
  Copy,
  Check,
  CalendarBlank,
  FrameCorners,
  Trash,
  YoutubeLogo,
} from "@phosphor-icons/react";
import Image from "next/image";
import { Spinner } from "@/components/ui/spinner";
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
import { Button } from "@/components/ui/button";
import { getCdnUrl } from "@/lib/video-utils";

const cdnLoader = ({ src }: { src: string }) => src;

export interface ThumbnailDetailData {
  id: string;
  status: string;
  prompt: string;
  title?: string | null;
  description?: string | null;
  link?: string | null;
  outputUrl?: string | null;
  thumbnailUrl?: string | null;
  error?: string | null;
  createdAt: string;
}

interface ThumbnailDetailDialogProps {
  thumbnail: ThumbnailDetailData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (id: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Completed",
  FAILED: "Failed",
  QUEUED: "Queued",
  PROCESSING: "Processing",
  submitting: "Submitting",
};

export function ThumbnailDetailDialog({
  thumbnail,
  open,
  onOpenChange,
  onDelete,
}: ThumbnailDetailDialogProps) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const copyPrompt = useCallback(() => {
    if (!thumbnail) return;
    navigator.clipboard.writeText(thumbnail.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [thumbnail]);

  if (!thumbnail) return null;

  const isCompleted = thumbnail.status === "COMPLETED";
  const isFailed = thumbnail.status === "FAILED";
  const imageUrl = thumbnail.outputUrl || thumbnail.thumbnailUrl;
  const displayTitle =
    thumbnail.title?.trim() || thumbnail.prompt || "Untitled thumbnail";
  const createdDate = new Date(thumbnail.createdAt).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogTitle className="sr-only">Thumbnail details</DialogTitle>
        <DialogDescription className="sr-only">
          Thumbnail generation details
        </DialogDescription>
        <div className="grid max-h-[90vh] grid-cols-1 overflow-y-auto sm:grid-cols-5">
          <div className="flex aspect-video items-center justify-center bg-black sm:col-span-3 sm:aspect-auto sm:max-h-[90vh] sm:min-h-0">
            {isCompleted && imageUrl ? (
              <div className="relative size-full min-h-[200px]">
                <Image
                  loader={cdnLoader}
                  src={getCdnUrl(imageUrl)}
                  alt={displayTitle}
                  fill
                  sizes="(min-width: 640px) 60vw, 100vw"
                  className="object-contain"
                />
              </div>
            ) : isFailed ? (
              <div className="flex flex-col items-center gap-2 px-6 py-12">
                <Warning className="size-8 text-destructive" />
                <p className="text-center text-sm text-destructive">
                  {thumbnail.error || "Generation failed"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-12">
                <Spinner className="size-8 text-white/50" />
                <span className="text-sm text-white/50">Processing…</span>
              </div>
            )}
          </div>

          <div className="flex min-h-0 shrink-0 flex-col sm:col-span-2">
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <YoutubeLogo className="size-3.5" weight="fill" />
                Thumbnail Maker
              </span>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Prompt
                  </span>
                  <button
                    type="button"
                    onClick={copyPrompt}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3" weight="bold" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <p className="max-h-[300px] overflow-y-auto text-sm leading-relaxed text-foreground">
                  {thumbnail.prompt}
                </p>
              </div>

              {thumbnail.description?.trim() && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Description
                  </span>
                  <p className="text-sm leading-relaxed text-foreground">
                    {thumbnail.description}
                  </p>
                </div>
              )}

              <div className="space-y-2.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Details
                </span>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <FrameCorners className="size-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Aspect ratio
                      </p>
                      <p className="text-xs font-medium">16:9</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Status
                      </p>
                      <p className="text-xs font-medium">
                        {STATUS_LABELS[thumbnail.status] ?? thumbnail.status}
                      </p>
                    </div>
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-2 rounded-lg border px-3 py-2">
                    <CalendarBlank className="size-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Created
                      </p>
                      <p className="text-xs font-medium">{createdDate}</p>
                    </div>
                  </div>
                </div>
              </div>

              {thumbnail.link?.trim() && (
                <a
                  href={thumbnail.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline-offset-2 hover:underline"
                >
                  View source link
                </a>
              )}
            </div>

            <div className="flex shrink-0 gap-2 border-t p-4">
              {isCompleted && imageUrl && (
                <a
                  href={getCdnUrl(imageUrl, { download: true })}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button className="w-full" variant="outline">
                    <DownloadSimple className="size-4" weight="bold" />
                    Download
                  </Button>
                </a>
              )}
              {onDelete && (
                <Button
                  variant="destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash className="size-4" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete thumbnail?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this thumbnail generation. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onDelete?.(thumbnail.id);
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
