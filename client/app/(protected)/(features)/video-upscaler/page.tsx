"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { VideoUpscalerForm } from "@/components/video-upscaler/upload-form";
import { VideoCard } from "@/components/subtitle-remover/video-card";
import { VideoDetailDialog } from "@/components/video-upscaler/video-detail-dialog";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { ArrowsClockwise, FileVideo } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface UpscaleJob {
  id: string;
  originalName: string;
  originalAsset?: { id: string; url: string } | null;
  processedAsset?: { id: string; url: string } | null;
  status: string;
  error?: string | null;
  upscaleModel?: string | null;
  createdAt: string;
}

const POLL_INTERVAL = 5_000;

export default function VideoUpscalerPage() {
  const { authFetch } = useAuthFetch();
  const [jobs, setJobs] = useState<UpscaleJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);
  const fetchingRef = useRef(false);
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
          const res = await authFetch(
            `/api/video-upscaler/refresh/${jobId}`,
          );
          if (!res.ok) return;
          const data = await res.json();
          if (!data.success || !data.job) return;

          const job = data.job as UpscaleJob;
          setJobs((prev) =>
            prev.map((j) => (j.id === jobId ? { ...j, ...job } : j)),
          );

          if (job.status === "completed" || job.status === "failed") {
            stopPolling(jobId);
            if (job.status === "completed") {
              toast.success(`${job.originalName} upscaled!`);
            } else {
              toast.error(
                `${job.originalName} failed: ${job.error || "Unknown error"}`,
              );
            }
          }
        } catch {
          // keep polling on network errors
        }
      }, POLL_INTERVAL);

      pollTimers.current.set(jobId, timer);
    },
    [authFetch, stopPolling],
  );

  const fetchJobs = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        const res = await authFetch(
          `/api/video-upscaler/all?page=${pageNum}&limit=20`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.jobs) {
          const fetched = data.jobs as UpscaleJob[];
          setJobs((prev) => (append ? [...prev, ...fetched] : fetched));
          setHasMore(data.pagination?.hasNextPage ?? false);
          pageRef.current = pageNum;

          fetched.forEach((j) => {
            if (j.status === "queued" || j.status === "processing") {
              startPolling(j.id);
            }
          });
        }
      } catch {
        if (!append) setJobs([]);
      } finally {
        setLoading(false);
      }
    },
    [authFetch, startPolling],
  );

  const handleRefresh = useCallback(() => {
    setLoading(true);
    fetchJobs(1, false);
  }, [fetchJobs]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const timers = pollTimers.current;
    return () => {
      timers.forEach((timer) => clearInterval(timer));
    };
  }, []);

  const handleSubmit = useCallback(
    async (
      videos: {
        videoUrl: string;
        originalName: string;
        model: string;
        duration?: number;
      }[],
    ) => {
      setSubmitting(true);
      try {
        const created: UpscaleJob[] = [];

        for (const video of videos) {
          const res = await authFetch("/api/video-upscaler/create", {
            method: "POST",
            body: JSON.stringify({
              videoUrl: video.videoUrl,
              originalName: video.originalName,
              model: video.model,
              duration: video.duration,
            }),
          });

          const data = await res.json();

          if (!res.ok || !data.success) {
            toast.error(
              `${video.originalName}: ${data.error || "Failed to start upscaling"}`,
            );
            continue;
          }

          created.push({
            id: data.job.id,
            originalName: video.originalName,
            originalAsset: { id: "", url: video.videoUrl },
            status: data.job.status,
            upscaleModel: data.job.model,
            createdAt: new Date().toISOString(),
          });
        }

        if (created.length > 0) {
          toast.success(
            `${created.length} video${created.length > 1 ? "s" : ""} queued for upscaling`,
          );
          setJobs((prev) => [...created, ...prev]);
          created.forEach((j) => startPolling(j.id));
        }

        pageRef.current = 1;
      } catch {
        toast.error("Network error — please try again");
      } finally {
        setSubmitting(false);
      }
    },
    [authFetch, startPolling],
  );

  const loadMore = useCallback(() => {
    if (fetchingRef.current || !hasMore) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    const next = pageRef.current + 1;
    fetchJobs(next, true).finally(() => {
      setLoadingMore(false);
      fetchingRef.current = false;
    });
  }, [hasMore, fetchJobs]);

  const { ref: sentinelRef } = useInView({
    rootMargin: "200px",
    skip: loading || loadingMore || !hasMore,
    onChange: (inView) => {
      if (inView) loadMore();
    },
  });

  const handleDelete = useCallback(
    async (jobId: string) => {
      try {
        const res = await authFetch(`/api/video-upscaler/${jobId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setJobs((prev) => prev.filter((j) => j.id !== jobId));
          stopPolling(jobId);
          toast.success("Video deleted");
        }
      } catch {
        toast.error("Failed to delete video");
      }
    },
    [authFetch, stopPolling],
  );

  const [selectedJob, setSelectedJob] = useState<UpscaleJob | null>(null);

  const isEmpty = jobs.length === 0;

  return (
    <div className="flex flex-1 flex-col lg:flex-row lg:max-h-[calc(100vh-64px)]">
      <VideoUpscalerForm onSubmit={handleSubmit} isSubmitting={submitting} />

      <div className="flex flex-1 flex-col lg:overflow-hidden">
        <div className="flex bg-card items-center justify-between border-b px-3 py-3 sm:px-5">
          <h2 className="text-sm font-semibold">Results</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="gap-1.5 text-xs"
          >
            <ArrowsClockwise className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading…" : "Refresh"}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">
          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-video rounded-xl" />
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                <FileVideo className="size-7 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  No output yet
                </p>
                <p className="mt-1 max-w-[260px] text-xs text-muted-foreground/70">
                  Upload videos and choose a model — your upscaled results will
                  appear here
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="mt-2 gap-1.5"
              >
                <ArrowsClockwise className="size-3.5" />
                Load previous results
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {jobs.map((job) => (
                  <VideoCard
                    key={job.id}
                    video={{
                      id: job.id,
                      originalName: job.originalName,
                      originalUrl: job.originalAsset?.url ?? "",
                      processedUrl: job.processedAsset?.url ?? null,
                      status: job.status,
                      error: job.error,
                    }}
                    displayMode="asset"
                    onDelete={handleDelete}
                    onClick={() => setSelectedJob(job)}
                  />
                ))}
              </div>
              {hasMore && (
                <div ref={sentinelRef} className="flex justify-center py-6">
                  {loadingMore && (
                    <Spinner className="size-5 text-muted-foreground" />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <VideoDetailDialog
        job={selectedJob ? {
          id: selectedJob.id,
          originalName: selectedJob.originalName,
          originalUrl: selectedJob.originalAsset?.url ?? "",
          processedUrl: selectedJob.processedAsset?.url ?? null,
          status: selectedJob.status,
          error: selectedJob.error,
          upscaleModel: selectedJob.upscaleModel,
          createdAt: selectedJob.createdAt,
        } : null}
        open={selectedJob !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedJob(null);
        }}
        onDelete={(id) => {
          handleDelete(id);
          setSelectedJob(null);
        }}
      />
    </div>
  );
}
