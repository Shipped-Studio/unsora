"use client";

import { useState } from "react";
import { Eraser } from "@phosphor-icons/react";
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
    <ToolPage className="p-0 sm:p-0 lg:flex-row lg:items-start">
      <ToolSidebar>
        <SubtitleRemoverForm onSubmit={handleSubmit} />
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
            icon={Eraser}
            title="No videos yet"
            description="Upload a video with burned-in subtitles to get a clean copy."
          />
        ) : (
          <>
            <ToolGrid shape="video">
              {jobs.items.map((job) => (
                <VideoJobCard
                  key={job.id}
                  job={job}
                  activeLabel="Removing subtitles"
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
        processedLabel="Subtitles removed"
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </ToolPage>
  );
}
