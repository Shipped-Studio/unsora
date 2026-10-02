"use client";

import { useState } from "react";
import { Eraser } from "@phosphor-icons/react";
import { toast } from "sonner";
import { ToolEmpty, ToolPage } from "@/components/generator/tool-layout";
import { ErrorState } from "@/components/shared/states";
import {
  SubtitleRemoverForm,
  type SubtitleRemovalInput,
} from "@/components/subtitle-remover/upload-form";
import {
  VideoJobCard,
  VideoJobCardSkeleton,
} from "@/components/subtitle-remover/video-card";
import { VideoCompareDialog } from "@/components/subtitle-remover/video-detail-dialog";
import { Spinner } from "@/components/ui/spinner";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useVideoJobs, type VideoJob } from "@/hooks/use-video-jobs";

export default function SubtitleRemoverPage() {
  const { authFetch } = useAuthFetch();
  const jobs = useVideoJobs("subtitle-removal");
  const { hasNextPage, isFetchingNextPage, loadMoreSentinel } = jobs;
  const [selected, setSelected] = useState<VideoJob | null>(null);

  async function handleSubmit(videos: SubtitleRemovalInput[]) {
    try {
      const res = await authFetch("/api/videos/create-process", {
        method: "POST",
        body: JSON.stringify({ videos, operations: ["watermark_removal"] }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        toast.error(
          body?.error || "Couldn't start subtitle removal. Try again.",
        );
        return false;
      }
      await jobs.invalidate();
      return true;
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
      return false;
    }
  }

  return (
    <ToolPage className="p-0 sm:p-0 lg:flex lg:items-start">
      <aside className="border-b lg:sticky lg:top-14 lg:h-[calc(100svh-3.5rem)] lg:w-95 lg:shrink-0 lg:border-r lg:border-b-0">
        <SubtitleRemoverForm onSubmit={handleSubmit} />
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
            icon={Eraser}
            title="No videos yet"
            description="Upload a video with burned-in subtitles to get a clean copy."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4">
              {jobs.items.map((job) => (
                <VideoJobCard
                  key={job.id}
                  job={job}
                  activeLabel="Removing subtitles"
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
        processedLabel="Subtitles removed"
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </ToolPage>
  );
}
