"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuthFetch } from "./use-auth-fetch";
import { toast } from "sonner";

export type UpscaleStatus =
  | "uploading"
  | "ready"
  | "submitting"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface UpscaleJob {
  id: string;
  status: UpscaleStatus;
  error?: string;
  inputAsset?: { id: string; url: string } | null;
  outputAsset?: { id: string; url: string } | null;
  thumbnailAsset?: { id: string; url: string } | null;
  originalName: string;
  createdAt: string;
  uploadProgress?: number;
}

const POLL_INTERVAL_MS = 4_000;

export function useImageUpscaler() {
  const { authFetch } = useAuthFetch();
  const [jobs, setJobs] = useState<UpscaleJob[]>([]);
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

  const updateJob = useCallback(
    (id: string, patch: Partial<UpscaleJob>) =>
      setJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, ...patch } : j)),
      ),
    [],
  );

  const pollStatus = useCallback(
    (jobId: string) => {
      if (pollTimers.current.has(jobId)) return;
      const timer = setInterval(async () => {
        try {
          const res = await authFetch(
            `/api/image-upscaler/refresh/${jobId}`,
          );
          if (!res.ok) return;

          const data = await res.json();
          const job = data.job;
          if (!job) return;

          updateJob(jobId, {
            status: job.status as UpscaleStatus,
            error: job.error || undefined,
            outputAsset: job.outputAsset || undefined,
            thumbnailAsset: job.thumbnailAsset || undefined,
          });

          if (job.status === "COMPLETED" || job.status === "FAILED") {
            stopPolling(jobId);
            if (job.status === "COMPLETED") {
              toast.success("Image upscaled successfully!");
            } else {
              toast.error(
                `Upscale failed: ${job.error || "Unknown error"}`,
              );
            }
          }
        } catch {
          // keep polling through network blips
        }
      }, POLL_INTERVAL_MS);

      pollTimers.current.set(jobId, timer);
    },
    [authFetch, stopPolling, updateJob],
  );

  const submitUpscale = useCallback(
    async (imageUrl: string, originalName: string, tempId: string, resolution: string = "4k") => {
      updateJob(tempId, { status: "submitting" });

      try {
        const res = await authFetch("/api/image-upscaler/create", {
          method: "POST",
          body: JSON.stringify({ imageUrl, resolution }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          const errorMsg = data.error || "Failed to start upscale";
          updateJob(tempId, { status: "FAILED", error: errorMsg });
          toast.error(errorMsg);
          return null;
        }

        const realId = data.job.id;
        setJobs((prev) =>
          prev.map((j) =>
            j.id === tempId
              ? {
                  ...j,
                  id: realId,
                  status: data.job.status as UpscaleStatus,
                }
              : j,
          ),
        );

        pollStatus(realId);
        return realId;
      } catch {
        updateJob(tempId, { status: "FAILED", error: "Network error" });
        toast.error("Network error — please try again");
        return null;
      }
    },
    [authFetch, pollStatus, updateJob],
  );

  const addJob = useCallback((job: UpscaleJob) => {
    setJobs((prev) => [job, ...prev]);
  }, []);

  const dismissJob = useCallback(
    (jobId: string) => {
      stopPolling(jobId);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    },
    [stopPolling],
  );

  useEffect(() => {
    const timers = pollTimers.current;
    return () => {
      timers.forEach((timer) => clearInterval(timer));
      timers.clear();
    };
  }, []);

  return {
    jobs,
    addJob,
    updateJob,
    submitUpscale,
    dismissJob,
  };
}
