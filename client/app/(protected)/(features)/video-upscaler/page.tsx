"use client";

import { useState } from "react";
import { ArrowsOut } from "@phosphor-icons/react";
import { toast } from "sonner";
import { ToolEmpty, ToolPage } from "@/components/generator/tool-layout";
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
    <ToolPage className="p-0 sm:p-0 lg:flex lg:items-start">
      <aside className="border-b lg:sticky lg:top-14 lg:h-[calc(100svh-3.5rem)] lg:w-95 lg:shrink-0 lg:border-r lg:border-b-0">
        <VideoUpscalerForm onSubmit={handleSubmit} />
      </aside>

      <section
        aria-label="Results"
        className="@container min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-6"
      >
        {jobs.isLoading ? (
          <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <VideoJobCardSkeleton key={i} />
            ))}
          </div>
        ) : jobs.isError ? (
          <ErrorState
            title="Couldn't load your videos"
            description={jobs.error?.message}
            onRetry={() => void jobs.refetch()}
          />
        ) : jobs.items.length === 0 ? (
          <ToolEmpty
            icon={ArrowsOut}
            title="No upscaled videos yet"
            description="Upload a video and pick a model to increase its resolution."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4">
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
            </div>
            {hasNextPage ? (
              <div ref={loadMoreSentinel} className="flex justify-center py-6">
                {isFetchingNextPage ? (
                  <Spinner className="text-muted-foreground" />
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>

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
