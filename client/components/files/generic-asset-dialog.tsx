"use client";

import {
  Copy,
  Check,
  DownloadSimple,
  File,
  Trash,
  Warning,
  FileVideo,
  ImageSquare,
  MusicNotes,
  Sparkle,
  CaretDown,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
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
import type { UnifiedAsset } from "@/hooks/use-all-assets";

const cdnLoader = ({ src }: { src: string }) => src;

const PROCESSING_STATUSES = new Set([
  "QUEUED",
  "PROCESSING",
  "SUBMITTING",
  "queued",
  "processing",
  "submitting",
]);

const MODE_LABELS: Record<string, string> = {
  OMNI_REFERENCE: "Omni Reference",
  FIRST_LAST_FRAMES: "First/Last Frames",
  TEXT_TO_VIDEO: "Text to Video",
  IMAGE_TO_VIDEO: "Image to Video",
  MOTION_CONTROL: "Motion Control",
  WATERMARK_REMOVAL: "Subtitle Removed",
  UPSCALING: "Upscaled",
  BASIC: "Basic Image",
  MOVIE_MATERIALS: "Movie Materials",
  INFLUENCER: "Influencer",
  UPSCALE: "Upscale",
};

interface GenericAssetDialogProps {
  asset: UnifiedAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (asset: UnifiedAsset) => void;
  isDeleting?: boolean;
}

export function GenericAssetDialog({
  asset,
  open,
  onOpenChange,
  onDelete,
  isDeleting = false,
}: GenericAssetDialogProps) {
  const [copied, setCopied] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const copyPrompt = useCallback(() => {
    if (!asset?.prompt) return;
    navigator.clipboard.writeText(asset.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [asset?.prompt]);

  const infoRows = useMemo(() => {
    if (!asset) return [];
    const featureKey =
      asset.generationMode ?? asset.imageGenerationType ?? null;
    const fl = featureKey ? (MODE_LABELS[featureKey] ?? featureKey) : null;
    const rows: { label: string; value: string }[] = [];
    if (fl) rows.push({ label: "Feature", value: fl });
    if (asset.model) rows.push({ label: "Model", value: asset.model });
    if (asset.ratio) rows.push({ label: "Ratio", value: asset.ratio });
    if (asset.resolution)
      rows.push({ label: "Resolution", value: asset.resolution });
    if (asset.duration != null && asset.duration > 0)
      rows.push({
        label: "Duration",
        value: `${Math.round(asset.duration)}s`,
      });
    rows.push({
      label: "Created",
      value: new Date(asset.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
    return rows;
  }, [asset]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setPromptExpanded(false);
      setCopied(false);
      setConfirmDeleteOpen(false);
    }
  }, [open, asset?.id]);

  if (!open || !asset) return null;

  const status = asset.status ?? "UNKNOWN";
  const statusUpper = status.toUpperCase();
  const isProcessing = PROCESSING_STATUSES.has(status);
  const isCompleted =
    statusUpper === "COMPLETED" || statusUpper === "SUCCESS";
  const isFailed = statusUpper === "FAILED" || statusUpper === "ERROR";
  const isVideo = asset.mediaType === "video";
  const isImage = asset.mediaType === "image";
  const isAudio = asset.mediaType === "audio";

  const outputUrl = asset.outputUrl ? getCdnUrl(asset.outputUrl) : null;
  const thumbnailUrl = asset.thumbnailUrl
    ? getCdnUrl(asset.thumbnailUrl)
    : null;
  const imageUrl = outputUrl ?? thumbnailUrl;
  const downloadUrl = outputUrl ?? imageUrl;
  const label = asset.name ?? asset.prompt ?? "Asset";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-label={label}
        className="relative z-10 flex h-dvh w-dvw flex-col overflow-hidden bg-background md:h-[calc(100vh-2rem)] md:w-[calc(100vw-2rem)] md:flex-row md:rounded-2xl md:border md:border-border md:shadow-2xl"
      >
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-20 flex size-8 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
        >
          <X className="size-4" weight="bold" />
        </button>

        {/* ── Left: Media ── */}
        <div className="relative flex min-h-[40vh] shrink-0 items-center justify-center bg-black md:min-h-0 md:flex-1 md:shrink">
          {isCompleted && (outputUrl || imageUrl) ? (
            <>
              {isVideo ? (
                <video
                  src={outputUrl ?? undefined}
                  poster={thumbnailUrl ?? undefined}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="h-full w-full object-contain"
                />
              ) : isImage ? (
                <div className="relative h-full w-full">
                  <Image
                    loader={cdnLoader}
                    src={imageUrl!}
                    alt={label}
                    fill
                    sizes="70vw"
                    className="object-contain"
                  />
                </div>
              ) : isAudio ? (
                <div className="flex w-full max-w-2xl flex-col items-center gap-5 px-8 text-white">
                  <MusicNotes className="size-16 text-white/50" />
                  <audio
                    src={outputUrl ?? undefined}
                    controls
                    className="w-full"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-white/50">
                  <File className="size-16" />
                  <p className="text-sm">Preview not available</p>
                </div>
              )}
            </>
          ) : isFailed ? (
            <div className="flex flex-col items-center gap-3 px-8 py-10">
              <Warning className="size-10 text-destructive" />
              <p className="max-w-md text-center text-sm text-destructive">
                {asset.error || "Processing failed"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-white/50">
              {isProcessing ? (
                <>
                  <Spinner className="size-8" />
                  <span className="text-sm">Processing...</span>
                </>
              ) : isVideo ? (
                <FileVideo className="size-14" />
              ) : isImage ? (
                <ImageSquare className="size-14" />
              ) : isAudio ? (
                <MusicNotes className="size-14" />
              ) : (
                <UploadSimple className="size-14" />
              )}
            </div>
          )}
        </div>

        {/* ── Right: Details ── */}
        <div className="flex min-h-0 flex-1 flex-col border-t border-border md:w-[340px] md:flex-none md:border-l md:border-t-0">
          <div className="flex-1 overflow-y-auto">
            {/* Prompt */}
            {asset.prompt && (
              <div className="border-b border-border px-5 py-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Sparkle className="size-3.5" weight="fill" />
                    Prompt
                  </span>
                  <button
                    onClick={copyPrompt}
                    className="rounded-md border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {copied ? (
                      <span className="flex items-center gap-1">
                        <Check className="size-3" weight="bold" />
                        Copied
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Copy className="size-3" />
                        Copy
                      </span>
                    )}
                  </button>
                </div>
                <p
                  className={`text-sm leading-relaxed text-foreground/90 ${
                    promptExpanded ? "" : "line-clamp-4"
                  }`}
                >
                  {asset.prompt}
                </p>
                {asset.prompt.length > 120 && (
                  <button
                    onClick={() => setPromptExpanded(!promptExpanded)}
                    className="mt-2 flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {promptExpanded ? "Show less" : "See all"}
                    <CaretDown
                      className={`size-3 transition-transform ${promptExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                )}
              </div>
            )}

            {/* Information */}
            <div className="px-5 py-5">
              <span className="mb-3 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Information
              </span>
              <div className="divide-y divide-border">
                {infoRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between py-3"
                  >
                    <span className="text-sm text-muted-foreground">
                      {row.label}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 border-t border-border p-4">
            <Button
              className="flex-1"
              disabled={!downloadUrl}
              render={
                <a
                  href={
                    downloadUrl
                      ? getCdnUrl(downloadUrl, { download: true })
                      : "#"
                  }
                  download
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (!downloadUrl) e.preventDefault();
                  }}
                />
              }
            >
              <DownloadSimple className="size-4" weight="bold" />
              Download
            </Button>
            {onDelete && (
              <Button
                variant="destructive"
                size="icon"
                disabled={isDeleting}
                onClick={() => setConfirmDeleteOpen(true)}
                aria-label="Delete asset"
              >
                <Trash className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {onDelete && asset && (
        <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete asset?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The selected asset will be
                permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isDeleting}
                onClick={() => {
                  onDelete(asset);
                  setConfirmDeleteOpen(false);
                }}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>,
    document.body,
  );
}
