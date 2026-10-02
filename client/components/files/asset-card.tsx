"use client";

import {
  Warning,
  Play,
  ImageSquare,
  VideoCamera,
  UploadSimple,
} from "@phosphor-icons/react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getCdnUrl } from "@/lib/video-utils";
import { Spinner } from "@/components/ui/spinner";
import { VideoThumbnail } from "@/components/ui/video-thumbnail";
import type { UnifiedAsset, FilterTab } from "@/hooks/use-all-assets";

const cdnLoader = ({ src }: { src: string }) => src;

const CATEGORY_LABELS: Record<FilterTab, string> = {
  video: "Video",
  image: "Image",
  uploaded: "Upload",
};

interface AssetCardProps {
  asset: UnifiedAsset;
  onClick?: () => void;
  displayMode?: "default" | "gallery";
}

export function AssetCard({
  asset,
  onClick,
  displayMode = "default",
}: AssetCardProps) {
  const isProcessing =
    asset.status === "QUEUED" ||
    asset.status === "PROCESSING" ||
    asset.status === "submitting" ||
    asset.status === "queued" ||
    asset.status === "processing";
  const isCompleted =
    asset.status === "COMPLETED" || asset.status === "completed";
  const isFailed = asset.status === "FAILED" || asset.status === "failed";
  const isVideo = asset.mediaType === "video";
  const isImage = asset.mediaType === "image";
  const isAudio = asset.mediaType === "audio";

  const outputUrl = asset.outputUrl ? getCdnUrl(asset.outputUrl) : null;
  const thumbUrl = asset.thumbnailUrl ? getCdnUrl(asset.thumbnailUrl) : null;
  const displayUrl = outputUrl || thumbUrl;
  const label = asset.prompt || asset.name || CATEGORY_LABELS[asset.category];
  const isGallery = displayMode === "gallery";

  return (
    <div
      className={cn(
        "group overflow-hidden rounded-xl border bg-card transition-all",
        isProcessing && "border-primary/20",
        isFailed && "border-destructive/20",
        !isProcessing && "cursor-pointer",
        !isGallery && !isProcessing && "hover:border-primary/30",
      )}
      onClick={() => {
        if (!isProcessing) onClick?.();
      }}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden bg-card",
          isGallery ? "aspect-square" : "aspect-video",
        )}
      >
        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Spinner />
            <span className="text-xs text-muted-foreground">
              {asset.status === "submitting" ? "Starting..." : "Generating..."}
            </span>
          </div>
        )}

        {isCompleted && displayUrl && isVideo && (
          <>
            <VideoThumbnail
              videoUrl={outputUrl}
              thumbnailUrl={thumbUrl}
              alt={label}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <div className="flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
                <Play className="ml-0.5 size-4" weight="fill" />
              </div>
            </div>
          </>
        )}

        {isCompleted && displayUrl && isImage && (
          <Image
            loader={cdnLoader}
            src={displayUrl}
            alt={label}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover"
          />
        )}

        {isCompleted && displayUrl && isAudio && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
            <UploadSimple className="size-6" />
            <span className="text-xs">Audio file</span>
          </div>
        )}

        {isFailed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-destructive/5 px-4">
            <Warning className="size-5 text-destructive" />
            <span className="text-center text-[11px] leading-tight text-destructive">
              {asset.error || "Generation failed"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
