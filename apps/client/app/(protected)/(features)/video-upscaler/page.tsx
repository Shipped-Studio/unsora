"use client";

import { useState } from "react";
import { ArrowsOut } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  ToolEmpty,
  ToolGrid,
  ToolPage,
  ToolPane,
  ToolSidebar,
} from "@/components/generator/tool-layout";
import { ErrorState } from "@/components/shared/states";
import {
  VideoJobCard,
  VideoJobCardSkeleton,
} from "@/components/subtitle-remover/video-card";
import { VideoCompareDialog } from "@/components/subtitle-remover/video-detail-dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  upscaleModelLabel,
  VideoUpscalerForm,
  type VideoUpscaleInput,
} from "@/components/video-upscaler/upload-form";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useVideoJobs, type VideoJob } from "@/hooks/use-video-jobs";

export default function VideoUpscalerPage() {
  const { authFetch } = useAuthFetch();
  const jobs = useVideoJobs("upscale");
  const { hasNextPage, isFetchingNextPage, loadMoreSentinel } = jobs;
  const [selected, setSelected] = useState<VideoJob | null>(null);

  async function handleSubmit(videos: VideoUpscaleInput[]) {
    let started = 0;
    for (const video of videos) {
      try {
        const res = await authFetch("/api/video-upscaler/create", {
          method: "POST",
          body: JSON.stringify(video),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.success) {
          toast.error(
            `Couldn't upscale ${video.originalName}. ${body?.error || "Try again."}`,
          );
          continue;
        }
        started += 1;
      } catch {
        toast.error(
          `Couldn't upscale ${video.originalName}. Check your connection and try again.`,
        );
      }
    }
    if (started > 0) await jobs.invalidate();
    return started === videos.length;
  }

  return (
    <ToolPage className="p-0 sm:p-0 lg:flex-row lg:items-start">
      <ToolSidebar>
        <VideoUpscalerForm onSubmit={handleSubmit} />
      </ToolSidebar>

      <ToolPane label="Results">
        {jobs.isLoading ? (
          <ToolGrid shape="video">
            {Array.from({ length: 6 }).map((_, i) => (
              <VideoJobCardSkeleton key={i} />
            ))}
          </ToolGrid>
        ) : jobs.isError ? (
          <ErrorState
            title="Couldn't load your videos"
            description={jobs.error?.message}
            onRetry={() => void jobs.refetch()}
          />
        ) : jobs.items.length === 0 ? (
          <ToolEmpty
            showcase
            icon={ArrowsOut}
            title="No upscaled videos yet"
            description="Upload a video and pick a model to increase its resolution."
          />
        ) : (
          <>
            <ToolGrid shape="video">
              {jobs.items.map((job) => (
                <VideoJobCard
                  key={job.id}
                  job={job}
                  activeLabel="Upscaling"
                  detail={upscaleModelLabel(job.model)}
                  onOpen={() => setSelected(job)}
                  onDelete={() => void jobs.deleteItem(job.id)}
                />
              ))}
            </ToolGrid>
            {hasNextPage ? (
              <div ref={loadMoreSentinel} className="flex justify-center py-6">
                {isFetchingNextPage ? (
                  <Spinner className="text-muted-foreground" />
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </ToolPane>

      <VideoCompareDialog
        job={selected}
        processedLabel="Upscaled"
        detail={upscaleModelLabel(selected?.model)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </ToolPage>
  );
}
