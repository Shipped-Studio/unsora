"use client";

import { useState, useCallback } from "react";
import {
  Warning,
  DownloadSimple,
  Copy,
  Check,
  Clock,
  Cube,
  CalendarBlank,
  FrameCorners,
  Trash,
} from "@phosphor-icons/react";
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
import { type CardGeneration, MODEL_LABELS } from "./video-card";
import { getCdnUrl } from "@/lib/video-utils";

interface VideoDetailDialogProps {
  generation: CardGeneration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (id: string) => void;
}

export function VideoDetailDialog({
  generation,
  open,
  onOpenChange,
  onDelete,
}: VideoDetailDialogProps) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const copyPrompt = useCallback(() => {
    if (!generation) return;
    navigator.clipboard.writeText(generation.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generation]);

  if (!generation) return null;

  const label = MODEL_LABELS[generation.model] ?? generation.model;
  const isCompleted = generation.status === "COMPLETED";
  const isFailed = generation.status === "FAILED";
  const createdDate = new Date(generation.createdAt).toLocaleDateString(
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
      <DialogContent className="w-[95vw] sm:max-w-7xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">{label} Generation</DialogTitle>
        <DialogDescription className="sr-only">
          Video generation details
        </DialogDescription>
        <div className="grid grid-cols-1 sm:grid-cols-5 max-h-[90vh] overflow-y-auto">
          {/* Left — Video */}
          <div className="sm:col-span-3 bg-black flex items-center justify-center min-h-[300px]">
            {isCompleted && generation.outputUrl ? (
              <video
                src={getCdnUrl(generation.outputUrl)}
                poster={generation.thumbnailUrl ?? undefined}
                controls
                autoPlay
                loop
                playsInline
                className="w-full max-h-[70vh] object-contain"
              />
            ) : isFailed ? (
              <div className="flex flex-col items-center gap-2 px-6 py-12">
                <Warning className="size-8 text-destructive" />
                <p className="text-sm text-destructive text-center">
                  {generation.error || "Generation failed"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-12">
                <Spinner className="size-8 text-white/50" />
                <span className="text-sm text-white/50">Processing...</span>
              </div>
            )}
          </div>

          {/* Right — Details */}
          <div className="sm:col-span-2 flex flex-col  overflow-y-auto">
            <div className="flex-1 space-y-5 p-5">
              {/* Model badge */}
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  <Cube className="size-3.5" weight="fill" />
                  {label}
                </span>
              </div>

              {/* Prompt */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Prompt
                  </span>
                  <button
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
                <p className="text-sm leading-relaxed text-foreground max-h-[300px] overflow-y-auto">
                  {generation.prompt}
                </p>
              </div>

              {/* Metadata */}
              <div className="space-y-2.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Details
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {generation.duration != null && (
                    <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                      <Clock className="size-3.5 text-muted-foreground" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">
                          Duration
                        </p>
                        <p className="text-xs font-medium">
                          {generation.duration}s
                        </p>
                      </div>
                    </div>
                  )}
                  {generation.ratio && (
                    <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                      <FrameCorners className="size-3.5 text-muted-foreground" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">
                          Aspect Ratio
                        </p>
                        <p className="text-xs font-medium">
                          {generation.ratio}
                        </p>
                      </div>
                    </div>
                  )}
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
            </div>

            {/* Actions */}
            <div className="border-t p-4 space-y-2 flex gap-2">
              {isCompleted && generation.outputUrl && (
                <a
                  href={getCdnUrl(generation.outputUrl, { download: true })}
                  download
                  className="w-full flex-1"
                >
                  <Button className="w-full" variant="outline">
                    <DownloadSimple className="size-4" weight="bold" />
                    Download Video
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
            <AlertDialogTitle>Delete generation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this video generation. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onDelete?.(generation.id);
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
