"use client";

import { useRef, useCallback, useMemo } from "react";
import { FileVideo, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/ui/generate-button";
import { useVideoManager } from "@/hooks/use-video-manager";
import { useAssets } from "@/contexts/assets-context";
import { calculateSubtitleRemovalCredits, getCdnUrl } from "@/lib/video-utils";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

const MAX_FILES = 10;
const ACCEPTED_TYPES = ".mp4,.webm,.mov";

interface SubtitleRemoverFormProps {
  onSubmit: (
    videos: {
      videoUrl: string;
      originalName: string;
      method: string;
      durationSeconds: number;
    }[],
  ) => void;
  isSubmitting?: boolean;
}

export function SubtitleRemoverForm({
  onSubmit,
  isSubmitting,
}: SubtitleRemoverFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const { videos, handleFiles, addAssetVideo, removeVideo, clearAll } = useVideoManager(
    MAX_FILES,
    "subtitle-removal",
  );
  const { openAssets } = useAssets();

  const allUploaded =
    videos.length > 0 && videos.every((v) => v.uploadStatus === "completed");
  const hasUploading = videos.some((v) => v.uploadStatus === "uploading");
  const canSubmit = allUploaded && !isSubmitting && !hasUploading;

  const totalCredits = useMemo(
    () =>
      videos.reduce(
        (sum, v) =>
          sum + calculateSubtitleRemovalCredits(v.duration ?? 0),
        0,
      ),
    [videos],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dropRef.current?.classList.remove("border-primary", "bg-primary/5");
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dropRef.current?.classList.add("border-primary", "bg-primary/5");
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dropRef.current?.classList.remove("border-primary", "bg-primary/5");
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    const payload = videos
      .filter((v) => v.storageBlobUrl || v.url)
      .map((v) => ({
        videoUrl: (v.storageBlobUrl || v.url)!,
        originalName: v.name,
        method: v.url ? "url" : "upload",
        durationSeconds: v.duration ?? 0,
      }));
    onSubmit(payload);
  }, [canSubmit, videos, onSubmit]);

  return (
    <div className="flex w-full flex-col overflow-y-auto border-b bg-card p-4 sm:p-5 lg:h-full lg:w-[420px] lg:shrink-0 lg:border-b-0 lg:border-r">
      {/* Drop zone */}
      <div
        ref={dropRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "mb-5 rounded-xl border border-dashed border-border p-6 transition-colors",
          videos.length >= MAX_FILES && "pointer-events-none opacity-50",
        )}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
            <FileVideo className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold">
            Drop videos here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            Up to {MAX_FILES} files &middot; Max 2 min &middot; MP4, WebM, MOV
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            {videos.length}/{MAX_FILES} added
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full text-xs"
              onClick={() => inputRef.current?.click()}
            >
              Browse
            </Button>
            {/* <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
              onClick={() =>
                openAssets({
                  initialTab: "uploaded",
                  mediaTypeFilter: "video",
                  multiple: true,
                  onSelectMultiple: (assets) => {
                    let added = 0;
                    for (const asset of assets) {
                      if (asset.mediaType !== "video") continue;
                      const url = asset.outputUrl
                        ? getCdnUrl(asset.outputUrl)
                        : null;
                      if (!url) continue;
                      addAssetVideo({
                        name: asset.name || asset.prompt || "Library video",
                        url,
                      });
                      added++;
                    }
                    if (added === 0) {
                      toast.error("No valid video assets selected");
                    }
                  },
                })
              }
            >
              <FolderOpen className="size-3.5" />
              Library
            </Button> */}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* Video list */}
      {videos.length > 0 && (
        <div className="mb-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {videos.length} video{videos.length !== 1 && "s"}
            </span>
            <button
              onClick={clearAll}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear all
            </button>
          </div>

          <div className="grid max-h-[420px] grid-cols-5 gap-1.5 overflow-y-auto">
            {videos.map((video) => (
              <div
                key={video.id}
                className="group relative aspect-square overflow-hidden rounded-md bg-secondary"
              >
                {video.previewUrl ? (
                  <video
                    src={video.previewUrl}
                    className="size-full object-cover"
                    muted
                    playsInline
                  />
                ) : video.file ? (
                  <VideoThumbnail file={video.file} />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <FileVideo className="size-4 text-muted-foreground/40" />
                  </div>
                )}
                {video.uploadStatus === "uploading" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <span className="text-[10px] font-bold text-white">
                      {video.uploadProgress}%
                    </span>
                  </div>
                )}
                {video.uploadStatus === "pending" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Spinner className="size-3 text-white" />
                  </div>
                )}
                <button
                  onClick={() => removeVideo(video.id)}
                  className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="size-2.5" weight="bold" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit button */}
      <div className="mt-auto">
        <GenerateButton
          credits={totalCredits > 0 ? totalCredits : undefined}
          disabled={!canSubmit}
          onClick={handleSubmit}
          submitting={isSubmitting}
          label="Remove Subtitles"
          className="w-full"
        />
      </div>
    </div>
  );
}

function VideoThumbnail({ file }: { file: File }) {
  const videoUrl = URL.createObjectURL(file);

  return (
    <video
      src={videoUrl}
      className="size-full object-cover"
      muted
      playsInline
      onLoadedData={(e) => {
        const video = e.currentTarget;
        video.currentTime = 0.5;
      }}
    />
  );
}
