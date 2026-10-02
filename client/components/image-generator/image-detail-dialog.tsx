"use client";

import { useState, useCallback } from "react";
import {
  Warning,
  DownloadSimple,
  Copy,
  Check,
  Cube,
  CalendarBlank,
  FrameCorners,
  Image as ImageIcon,
  Trash,
  FilmStrip,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import Image from "next/image";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const cdnLoader = ({ src }: { src: string }) => src;
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

export type ImageGenerationType = "BASIC" | "MOVIE_MATERIALS" | "INFLUENCER";

export interface ImageDetailData {
  id: string;
  status: string;
  prompt: string;
  model?: string;
  type?: ImageGenerationType;
  ratio?: string;
  resolution?: string;
  mode?: string;
  params?: Record<string, unknown> | null;
  outputUrl?: string | null;
  thumbnailUrl?: string | null;
  error?: string | null;
  createdAt: string;
}

const BASIC_MODEL_LABELS: Record<string, string> = {
  "nano-banana-pro": "Nano Banana Pro",
  "nano-banana-2": "Nano Banana 2",
  "seedream-v5-lite": "Seedream v5 Lite",
  seedream_v5_lite: "Seedream v5 Lite",
  "gpt-image-1.5": "GPT Image 1.5",
  "gpt-image-2": "GPT Image 2",
  gpt_image_2: "GPT Image 2",
};

function getModelLabel(
  type?: ImageGenerationType,
  model?: string,
): string | undefined {
  if (type === "INFLUENCER") return "Influencer Studio";
  if (type === "MOVIE_MATERIALS") return "Movie Materials";
  if (!model) return undefined;
  return BASIC_MODEL_LABELS[model] ?? model;
}

interface ImageDetailDialogProps {
  generation: ImageDetailData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (id: string) => void;
}

export function ImageDetailDialog({
  generation,
  open,
  onOpenChange,
  onDelete,
}: ImageDetailDialogProps) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const copyPrompt = useCallback(() => {
    if (!generation) return;
    navigator.clipboard.writeText(generation.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generation]);

  if (!generation) return null;

  const label = getModelLabel(generation.type, generation.model);
  const isCompleted = generation.status === "COMPLETED";
  const isFailed = generation.status === "FAILED";
  const imageUrl = generation.outputUrl || generation.thumbnailUrl;
  const params = generation.params;
  // Only show primitive values — params may hold internal objects
  // (e.g. `api: { apiKeyId }` for API-created generations)
  const paramEntries = params
    ? Object.entries(params).filter(
        (entry): entry is [string, string | number] =>
          (typeof entry[1] === "string" && entry[1] !== "") ||
          typeof entry[1] === "number",
      )
    : [];
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
      <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">
          {label ?? "Image"} Generation
        </DialogTitle>
        <DialogDescription className="sr-only">
          Image generation details
        </DialogDescription>
        <div className="grid grid-cols-1 sm:grid-cols-5 max-h-[90vh] overflow-y-auto">
          {/* Left — Image */}
          <div className="sm:col-span-3 flex items-center justify-center bg-black aspect-square sm:aspect-auto sm:max-h-[90vh] sm:min-h-0">
            {isCompleted && imageUrl ? (
              <div className="relative size-full min-h-[260px]">
                <Image
                  loader={cdnLoader}
                  src={getCdnUrl(imageUrl)}
                  alt={generation.prompt}
                  fill
                  sizes="(min-width: 640px) 60vw, 100vw"
                  className="object-contain"
                />
              </div>
            ) : isFailed ? (
              <div className="flex flex-col items-center gap-2 px-6 py-12">
                <Warning className="size-8 text-destructive" />
                <p className="text-sm text-center text-destructive">
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
          <div className="sm:col-span-2 shrink-0 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto space-y-5 p-5">
              {/* Model / mode badge */}
              <div className="flex flex-wrap gap-2">
                {label && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    <Cube className="size-3.5" weight="fill" />
                    {label} 
                  </span>
                )}
                {generation.mode && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    <FilmStrip className="size-3.5" />
                    {generation.mode}
                  </span>
                )}
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
                <p className="max-h-[300px] overflow-y-auto text-sm leading-relaxed text-foreground">
                  {generation.prompt}
                </p>
              </div>

              {/* Metadata */}
              <div className="space-y-2.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Details
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  {generation.resolution && (
                    <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                      <ImageIcon className="size-3.5 text-muted-foreground" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">
                          Resolution
                        </p>
                        <p className="text-xs font-medium">
                          {generation.resolution}
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

              {/* Params */}
              {paramEntries.length > 0 && (
                <div className="space-y-2.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Parameters
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {paramEntries.map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2"
                      >
                        <div>
                          <p className="text-[10px] text-muted-foreground">
                            {key
                              .replace(/[-_]/g, " ")
                              .replace(/\b\w/g, (c) => c.toUpperCase())}
                          </p>
                          <p className="text-xs font-medium">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="shrink-0 flex gap-2 border-t p-4">
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
            <AlertDialogTitle>Delete generation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this image generation. This action
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
