"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { SubtitleRemoverForm } from "@/components/subtitle-remover/upload-form";
import { VideoCard } from "@/components/subtitle-remover/video-card";
import { VideoDetailDialog } from "@/components/subtitle-remover/video-detail-dialog";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { ArrowsClockwise, FileVideo } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface AssetRef {
  id: string;
  url: string;
}

interface ProcessedVideo {
  id: string;
  originalName: string;
  originalAsset?: AssetRef | null;
  processedAsset?: AssetRef | null;
  status: string;
  error?: string | null;
  createdAt: string;
}

const POLL_INTERVAL = 5_000;

export default function SubtitleRemoverPage() {
  const { authFetch } = useAuthFetch();
  const [results, setResults] = useState<ProcessedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);
  const fetchingRef = useRef(false);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );

  const stopPolling = useCallback((videoId: string) => {
    const timer = pollTimers.current.get(videoId);
    if (timer) {
      clearInterval(timer);
      pollTimers.current.delete(videoId);
    }
  }, []);

  const startPolling = useCallback(
    (videoId: string) => {
      if (pollTimers.current.has(videoId)) return;

      const timer = setInterval(async () => {
        try {
          const res = await authFetch(`/api/videos/refresh/${videoId}`);
          if (!res.ok) return;
          const data = await res.json();
          if (!data.success || !data.video) return;

          const video = data.video as ProcessedVideo;
          setResults((prev) =>
            prev.map((v) => (v.id === videoId ? { ...v, ...video } : v)),
          );

          if (video.status === "completed" || video.status === "failed") {
            stopPolling(videoId);
            if (video.status === "completed") {
              toast.success(`${video.originalName} processed!`);
            } else {
              toast.error(
                `${video.originalName} failed: ${video.error || "Unknown error"}`,
              );
            }
          }
        } catch {
          // keep polling on network errors
        }
      }, POLL_INTERVAL);

      pollTimers.current.set(videoId, timer);
    },
    [authFetch, stopPolling],
  );

  const fetchVideos = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        const res = await authFetch(
          `/api/videos/all?page=${pageNum}&limit=20&operation=WATERMARK_REMOVAL`,
        );
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        if (data.success && data.videos) {
          const videos = data.videos as ProcessedVideo[];
          setResults((prev) => (append ? [...prev, ...videos] : videos));
          setHasMore(data.pagination?.hasNextPage ?? false);
          pageRef.current = pageNum;

          videos.forEach((v) => {
            if (v.status === "queued" || v.status === "processing") {
              startPolling(v.id);
            }
          });
        }
      } catch {
        if (!append) setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [authFetch, startPolling],
  );

  const handleRefresh = useCallback(() => {
    setLoading(true);
    fetchVideos(1, false);
  }, [fetchVideos]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

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
        method: string;
        durationSeconds: number;
      }[],
    ) => {
      setSubmitting(true);
      try {
        const res = await authFetch("/api/videos/create-process", {
          method: "POST",
          body: JSON.stringify({
            videos,
            operations: ["watermark_removal"],
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          toast.error(data.error || "Failed to start processing");
          return;
        }

        toast.success(data.message);

        // Fetch the newly created records so we can track them
        const listRes = await authFetch(
          `/api/videos/all?page=1&limit=${videos.length}&operation=WATERMARK_REMOVAL`,
        );
        const listData = await listRes.json();

        if (listData.success && listData.videos) {
          const newVideos = listData.videos as ProcessedVideo[];
          setResults((prev) => {
            const existingIds = new Set(prev.map((v) => v.id));
            const fresh = newVideos.filter((v) => !existingIds.has(v.id));
            return [...fresh, ...prev];
          });

          newVideos.forEach((v) => {
            if (v.status === "queued" || v.status === "processing") {
              startPolling(v.id);
            }
          });
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
    fetchVideos(next, true).finally(() => {
      setLoadingMore(false);
      fetchingRef.current = false;
    });
  }, [hasMore, fetchVideos]);

  const { ref: sentinelRef } = useInView({
    rootMargin: "200px",
    skip: loading || loadingMore || !hasMore,
    onChange: (inView) => {
      if (inView) loadMore();
    },
  });

  const handleDelete = useCallback(
    async (videoId: string) => {
      try {
        const res = await authFetch(`/api/videos/${videoId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setResults((prev) => prev.filter((v) => v.id !== videoId));
          stopPolling(videoId);
          toast.success("Video deleted");
        }
      } catch {
        toast.error("Failed to delete video");
      }
    },
    [authFetch, stopPolling],
  );

  const [selectedVideo, setSelectedVideo] = useState<ProcessedVideo | null>(
    null,
  );

  const isEmpty = results.length === 0;

  return (
    <div className="flex flex-1 flex-col lg:flex-row lg:max-h-[calc(100vh-64px)]">
      <SubtitleRemoverForm onSubmit={handleSubmit} isSubmitting={submitting} />

      {/* Results panel */}
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
                  Upload videos and hit Remove Subtitles — your results will
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
                {results.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={{
                      id: video.id,
                      originalName: video.originalName,
                      originalUrl: video.originalAsset?.url ?? "",
                      processedUrl: video.processedAsset?.url ?? null,
                      status: video.status,
                      error: video.error,
                    }}
                    displayMode="asset"
                    onDelete={handleDelete}
                    onClick={() => setSelectedVideo(video)}
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
        video={selectedVideo ? {
          id: selectedVideo.id,
          originalName: selectedVideo.originalName,
          originalUrl: selectedVideo.originalAsset?.url ?? "",
          processedUrl: selectedVideo.processedAsset?.url ?? null,
          status: selectedVideo.status,
          error: selectedVideo.error,
          createdAt: selectedVideo.createdAt,
        } : null}
        open={selectedVideo !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedVideo(null);
        }}
        onDelete={(id) => {
          handleDelete(id);
          setSelectedVideo(null);
        }}
      />
    </div>
  );
}
