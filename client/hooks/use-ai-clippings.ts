"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { toast } from "sonner";

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

function isActiveStatus(status: string) {
  return status === "QUEUED" || status === "PROCESSING";
}

export function useAiClippings() {
  const { authFetch } = useAuthFetch();
  const [jobs, setJobs] = useState<AIClippingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );

  const stopPolling = useCallback((jobId: string) => {
    const timer = pollTimers.current.get(jobId);
    if (timer) {
      clearInterval(timer);
      pollTimers.current.delete(jobId);
    }
  }, []);

  const startPolling = useCallback(
    (jobId: string) => {
      if (pollTimers.current.has(jobId)) return;

      const timer = setInterval(async () => {
        try {
          const res = await authFetch(`/api/clippings/refresh/${jobId}`);
          if (!res.ok) return;

          const data = await res.json();
          if (!data.success || !data.data) return;

          const job = data.data as AIClippingJob;
          setJobs((prev) =>
            prev.map((j) => (j.id === jobId ? { ...j, ...job } : j)),
          );

          if (job.status === "COMPLETED") {
            stopPolling(jobId);
            toast.success(
              `Clipping complete · ${job.clips.length} clip${job.clips.length === 1 ? "" : "s"}`,
            );
          } else if (job.status === "FAILED") {
            stopPolling(jobId);
            toast.error(job.error || "Clipping failed");
          }
        } catch {
          // keep polling on network errors
        }
      }, POLL_INTERVAL_MS);

      pollTimers.current.set(jobId, timer);
    },
    [authFetch, stopPolling],
  );

  const fetchJobs = useCallback(async () => {
    try {
      const res = await authFetch("/api/clippings/all");
      if (!res.ok) return;

      const data = await res.json();
      if (!data.success || !Array.isArray(data.data)) return;

      const fetched = data.data as AIClippingJob[];
      setJobs(fetched);

      fetched.forEach((job) => {
        if (isActiveStatus(job.status)) {
          startPolling(job.id);
        }
      });
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch, startPolling]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchJobs();
  }, [fetchJobs]);

  const prependJob = useCallback(
    (job: AIClippingJob) => {
      setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
      if (isActiveStatus(job.status)) {
        startPolling(job.id);
      }
    },
    [startPolling],
  );

  const deleteJob = useCallback(
    async (jobId: string) => {
      try {
        const res = await authFetch(`/api/clippings/${jobId}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to delete job");
        }

        stopPolling(jobId);
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        toast.success("Clipping job deleted");
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete job",
        );
        return false;
      }
    },
    [authFetch, stopPolling],
  );

  const deleteClip = useCallback(
    async (jobId: string, clipId: string) => {
      try {
        const res = await authFetch(
          `/api/clippings/${jobId}/clips/${clipId}`,
          { method: "DELETE" },
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to delete clip");
        }

        setJobs((prev) =>
          prev.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  clips: job.clips.filter((clip) => clip.id !== clipId),
                }
              : job,
          ),
        );
        toast.success("Clip deleted");
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete clip",
        );
        return false;
      }
    },
    [authFetch],
  );

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const timers = pollTimers.current;
    return () => {
      timers.forEach((timer) => clearInterval(timer));
    };
  }, []);

  return {
    jobs,
    loading,
    refresh,
    prependJob,
    deleteJob,
    deleteClip,
    stopPolling,
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
