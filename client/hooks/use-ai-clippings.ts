"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { assertOk, usePollIds } from "@/hooks/use-paged-list";

export type ClippingStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface AIClippingClip {
  id: string;
  order: number;
  title?: string | null;
  startTime?: number | null;
  endTime?: number | null;
  duration?: number | null;
  status: ClippingStatus;
  error?: string | null;
  metadata?: {
    tags?: string[];
    desc?: string | null;
    score?: number | null;
    thumbnail?: string | null;
    export_link?: string | null;
    wayin_thumbnail?: string | null;
    wayin_export_link?: string | null;
  } | null;
  outputAsset?: { id: string; url: string } | null;
  thumbnailAsset?: { id: string; url: string } | null;
}

export interface AIClippingJob {
  id: string;
  videoUrl?: string | null;
  status: ClippingStatus;
  error?: string | null;
  config?: {
    sourceLang?: string | null;
    targetLang?: string | null;
    targetDuration?: string;
    query?: string | null;
    limit?: number | null;
    ratio?: string | null;
    enableCaption?: boolean;
    captionStyle?: string | null;
  } | null;
  metadata?: {
    clip_count?: number;
    wayin_status?: string;
  } | null;
  createdAt: string;
  clips: AIClippingClip[];
}

const POLL_INTERVAL_MS = 5_000;

export const aiClippingQueryKeys = {
  all: ["ai-clippings"] as const,
  list: () => [...aiClippingQueryKeys.all, "list"] as const,
};

export function isClippingActive(status: string) {
  return status === "QUEUED" || status === "PROCESSING";
}

/** Clipping jobs with their clips; active jobs are refreshed until done. */
export function useAiClippings() {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();
  const queryKey = aiClippingQueryKeys.list();

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<AIClippingJob[]> => {
      const res = await authFetch("/api/clippings/all");
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success || !Array.isArray(body.data)) {
        throw new Error(
          body?.error || "Couldn't load your clipping jobs. Try again.",
        );
      }
      return body.data as AIClippingJob[];
    },
  });

  const jobs = useMemo(() => query.data ?? [], [query.data]);

  const updateJobs = useCallback(
    (fn: (jobs: AIClippingJob[]) => AIClippingJob[]) => {
      queryClient.setQueryData<AIClippingJob[]>(
        aiClippingQueryKeys.list(),
        (prev) => fn(prev ?? []),
      );
    },
    [queryClient],
  );

  usePollIds(
    jobs.filter((job) => isClippingActive(job.status)).map((job) => job.id),
    async (jobId) => {
      const res = await authFetch(`/api/clippings/refresh/${jobId}`);
      if (!res.ok) return;
      const body = await res.json();
      if (!body?.success || !body.data) return;

      const job = body.data as AIClippingJob;
      updateJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, ...job } : j)),
      );

      if (job.status === "COMPLETED") {
        const count = job.clips?.length ?? 0;
        toast.success(
          count === 1 ? "Found 1 clip" : `Found ${count} clips`,
        );
      } else if (job.status === "FAILED") {
        toast.error(
          job.error
            ? `Couldn't clip the video. ${job.error}`
            : "Couldn't clip the video. Try again.",
        );
      }
    },
    POLL_INTERVAL_MS,
  );

  const prependJob = useCallback(
    (job: AIClippingJob) => {
      updateJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
    },
    [updateJobs],
  );

  const deleteJob = useCallback(
    async (jobId: string) => {
      try {
        const res = await authFetch(`/api/clippings/${jobId}`, {
          method: "DELETE",
        });
        await assertOk(res, "Couldn't delete the job. Try again.");
        updateJobs((prev) => prev.filter((j) => j.id !== jobId));
        toast.success("Job deleted");
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Couldn't delete the job. Try again.",
        );
        return false;
      }
    },
    [authFetch, updateJobs],
  );

  const deleteClip = useCallback(
    async (jobId: string, clipId: string) => {
      try {
        const res = await authFetch(`/api/clippings/${jobId}/clips/${clipId}`, {
          method: "DELETE",
        });
        await assertOk(res, "Couldn't delete the clip. Try again.");
        updateJobs((prev) =>
          prev.map((job) =>
            job.id === jobId
              ? { ...job, clips: job.clips.filter((c) => c.id !== clipId) }
              : job,
          ),
        );
        toast.success("Clip deleted");
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Couldn't delete the clip. Try again.",
        );
        return false;
      }
    },
    [authFetch, updateJobs],
  );

  return {
    jobs,
    isLoading: query.isPending,
    // A failed background refetch keeps showing the jobs we already have.
    error: query.data === undefined ? query.error : null,
    refetch: query.refetch,
    prependJob,
    deleteJob,
    deleteClip,
  };
}

export function getClipVideoUrl(clip: AIClippingClip) {
  return (
    clip.outputAsset?.url ||
    clip.metadata?.export_link ||
    clip.metadata?.wayin_export_link ||
    null
  );
}

export function getClipThumbnailUrl(clip: AIClippingClip) {
  return (
    clip.thumbnailAsset?.url ||
    clip.metadata?.thumbnail ||
    clip.metadata?.wayin_thumbnail ||
    null
  );
}

export function buildSourceTimestampUrl(
  sourceUrl?: string | null,
  startTime?: number | null,
) {
  if (!sourceUrl || startTime == null) return null;

  const seconds = Math.max(0, Math.floor(startTime));
  const youTubeMatch = sourceUrl.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/,
  );
  if (youTubeMatch?.[1]) {
    return `https://www.youtube.com/watch?v=${youTubeMatch[1]}&t=${seconds}s`;
  }

  try {
    const url = new URL(sourceUrl);
    url.hash = `t=${seconds}`;
    return url.toString();
  } catch {
    return sourceUrl;
  }
}
