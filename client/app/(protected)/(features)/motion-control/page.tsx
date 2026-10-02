"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { MotionUploadForm } from "@/components/motion-control/upload-form";
import {
  MotionGenerationCard,
  type MotionCardData,
} from "@/components/motion-control/generation-card";
import { MotionDetailDialog } from "@/components/motion-control/detail-dialog";
import { useMotionControl } from "@/hooks/use-motion-control";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { ArrowsClockwise, FilmStrip } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface MotionGeneration {
  id: string;
  status: string;
  prompt: string;
  model: string;
  outputAsset?: { id: string; url: string } | null;
  error?: string | null;
  createdAt: string;
}

export default function MotionControlPage() {
  const { authFetch } = useAuthFetch();
  const [generations, setGenerations] = useState<MotionGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedGeneration, setSelectedGeneration] =
    useState<MotionCardData | null>(null);
  const pageRef = useRef(1);
  const fetchingRef = useRef(false);

  const fetchGenerations = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        const res = await authFetch(
          `/api/motion-control/all?page=${pageNum}&limit=20`,
        );
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        if (data.success) {
          setGenerations((prev) =>
            append ? [...prev, ...data.generations] : data.generations,
          );
          setHasMore(data.pagination.hasNextPage);
          pageRef.current = pageNum;
        }
      } catch {
        if (!append) setGenerations([]);
      } finally {
        setLoading(false);
      }
    },
    [authFetch],
  );

  const handleRefresh = useCallback(() => {
    setLoading(true);
    fetchGenerations(1, false);
  }, [fetchGenerations]);

  const { activeGenerations, submitGeneration, dismissGeneration } =
    useMotionControl({
      onComplete: () => {
        fetchGenerations(1, false);
      },
    });

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  const handleSubmit = useCallback(
    async (params: {
      model: string;
      prompt: string;
      motion_video_url: string;
      character_image_url: string;
      resolution: string;
      keep_sound: boolean;
      character_orientation: "video" | "image";
    }) => {
      setSubmitting(true);
      try {
        const id = await submitGeneration(params);
        return id;
      } finally {
        setSubmitting(false);
      }
    },
    [submitGeneration],
  );

  const handleDelete = useCallback(
    async (generationId: string) => {
      try {
        const res = await authFetch(`/api/motion-control/${generationId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setGenerations((prev) => prev.filter((g) => g.id !== generationId));
          toast.success("Video deleted");
        }
      } catch {
        toast.error("Failed to delete video");
      }
    },
    [authFetch],
  );

  const loadMore = useCallback(() => {
    if (fetchingRef.current || !hasMore) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    const next = pageRef.current + 1;
    fetchGenerations(next, true).finally(() => {
      setLoadingMore(false);
      fetchingRef.current = false;
    });
  }, [hasMore, fetchGenerations]);

  const { ref: sentinelRef } = useInView({
    rootMargin: "200px",
    skip: loading || loadingMore || !hasMore,
    onChange: (inView) => {
      if (inView) loadMore();
    },
  });

  const activeIds = new Set(activeGenerations.map((g) => g.id));
  const fetchedIds = new Set(generations.map((g) => g.id));
  const pendingActive = activeGenerations.filter(
    (g) => !fetchedIds.has(g.id) && g.status !== "COMPLETED",
  );

  const allCards: MotionCardData[] = [
    ...pendingActive.map((g) => ({
      id: g.id,
      status: g.status,
      prompt: g.prompt,
      outputUrl: g.outputAsset?.url ?? null,
      error: g.error,
    })),
    ...generations.map((g) => {
      const active = activeIds.has(g.id)
        ? activeGenerations.find((a) => a.id === g.id)
        : undefined;
      return {
        id: g.id,
        status: active?.status ?? g.status,
        prompt: g.prompt,
        outputUrl: active?.outputAsset?.url ?? g.outputAsset?.url ?? null,
        error: active?.error ?? g.error,
        model: g.model,
        createdAt: g.createdAt,
      };
    }),
  ];

  const isEmpty = allCards.length === 0;

  return (
    <div className="flex flex-1 flex-col lg:flex-row lg:max-h-[calc(100vh-64px)]">
      <MotionUploadForm onSubmit={handleSubmit} isSubmitting={submitting} />

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
              <FilmStrip
                className="size-12 text-muted-foreground/40"
                weight="thin"
              />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  No motion control videos yet
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Upload a motion video and character image to get started
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
            <div className="pb-10">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {allCards.map((card) => (
                  <MotionGenerationCard
                    key={card.id}
                    generation={card}
                    displayMode="asset"
                    onDelete={handleDelete}
                    onDismiss={dismissGeneration}
                    onClick={setSelectedGeneration}
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
            </div>
          )}
        </div>
      </div>

      <MotionDetailDialog
        generation={selectedGeneration}
        open={selectedGeneration !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedGeneration(null);
        }}
        onDelete={(id) => {
          handleDelete(id);
          setSelectedGeneration(null);
        }}
      />
    </div>
  );
}
