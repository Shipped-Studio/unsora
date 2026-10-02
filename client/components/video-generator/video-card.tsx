"use client";

import { Warning, Play } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Spinner } from "../ui/spinner";
import { VideoThumbnail } from "../ui/video-thumbnail";
import { DeleteFailedButton } from "../ui/delete-failed-button";

export const MODEL_LABELS: Record<string, string> = {
  seedance: "Seedance 2.0",
  "seedance-fast": "Seedance Fast",
  "seedance-mini": "Seedance Mini",
  "kling-standard": "Kling Standard",
  "kling-pro": "Kling Pro",
  veo: "Veo 3.1",
  "gemini-omni-flash": "Omni Flash",
  "sora-2": "Sora 2",
  "sora-2-pro": "Sora 2 Pro",
  wan: "Wan 2.6",
  seedance_2_0_fast: "Seedance Fast",
  seedance_2_0: "Seedance 2.0",
  "seedance_2.0_fast": "Seedance Fast",
  "seedance_2.0": "Seedance 2.0",
  "seedance_2.0_mini": "Seedance Mini",
  kling_v3_std: "Kling Standard",
  kling_v3_pro: "Kling Pro",
  "veo_3.1": "Veo 3.1",
  gemini_omni_flash: "Omni Flash",
  sora_2: "Sora 2",
  sora_2_pro: "Sora 2 Pro",
  "wan_2.6": "Wan 2.6",
};

export interface CardGeneration {
  id: string;
  status: string;
  model: string;
  prompt: string;
  outputUrl?: string | null;
  thumbnailUrl?: string | null;
  error?: string | null;
  duration?: number;
  ratio?: string;
  createdAt: string;
}

interface VideoCardProps {
  generation: CardGeneration;
  onClick?: () => void;
  onDelete?: (id: string) => void;
  displayMode?: "default" | "asset";
}

export function VideoCard({
  generation,
  onClick,
  onDelete,
  displayMode = "default",
}: VideoCardProps) {
  const { status } = generation;
  const isProcessing =
    status === "QUEUED" || status === "PROCESSING" || status === "submitting";
  const isCompleted = status === "COMPLETED";
  const isFailed = status === "FAILED";
  const label = MODEL_LABELS[generation.model] ?? generation.model;
  const isAssetMode = displayMode === "asset";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card transition-all",
        isProcessing && "border-primary/20",
        isFailed && "border-destructive/20",
        (isCompleted || isFailed) && "cursor-pointer",
      )}
      onClick={() => {
        if (isCompleted || isFailed) onClick?.();
      }}
    >
      {isFailed && onDelete && (
        <DeleteFailedButton
          onConfirm={() => onDelete(generation.id)}
          title="Delete video?"
          description="This will permanently remove this failed video generation. This action cannot be undone."
        />
      )}
      <div
        className={cn(
          "relative w-full overflow-hidden bg-card",
          isAssetMode ? "aspect-square" : "aspect-video",
        )}
      >
        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 animate-pulse">
            <Spinner />
            <span className="text-xs text-muted-foreground">
              {status === "submitting" ? "Starting..." : "Generating..."}
            </span>
          </div>
        )}

        {isCompleted && generation.outputUrl && (
          <>
            <VideoThumbnail
              videoUrl={generation.outputUrl}
              thumbnailUrl={generation.thumbnailUrl}
              alt={generation.prompt}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <div className="flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
                <Play className="ml-0.5 size-4" weight="fill" />
              </div>
            </div>
          </>
        )}

        {isCompleted && !generation.outputUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">No video</span>
          </div>
        )}

        {isFailed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-destructive/5 px-4">
            <Warning className="size-5 text-destructive" />
            <span className="text-center text-[11px] leading-tight text-destructive">
              {generation.error || "Generation failed"}
            </span>
          </div>
        )}
      </div>

      {!isAssetMode && (
        <div className="p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-medium">{label}</span>
            {generation.duration != null && (
              <>
                <span>·</span>
                <span>{generation.duration}s</span>
              </>
            )}
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-foreground/80">
            {generation.prompt}
          </p>
        </div>
      )}
    </div>
  );
}
