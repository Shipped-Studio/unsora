"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { ImageSquare } from "@phosphor-icons/react";
import { ThumbPromptForm } from "@/components/thumbnail-generator/prompt-form";
import {
  ThumbnailGenerationCard,
  type ThumbnailGenerationCardData,
} from "@/components/thumbnail-generator/thumbnail-generation-card";
import {
  ThumbnailDetailDialog,
  type ThumbnailDetailData,
} from "@/components/thumbnail-generator/thumbnail-detail-dialog";
import { useThumbnailGeneration } from "@/hooks/use-thumbnail-generation";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type {
  ThumbmakerThumbnail,
  ThumbmakerThumbnailsListResponse,
} from "@/lib/thumbmaker-types";

export default function ThumbMakerPage() {
  const { authFetch } = useAuthFetch();
  const [thumbnails, setThumbnails] = useState<ThumbmakerThumbnail[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedThumbnail, setSelectedThumbnail] =
    useState<ThumbnailDetailData | null>(null);
  const pageRef = useRef(1);
  const fetchingRef = useRef(false);

  const fetchThumbnails = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        const res = await authFetch(`/api/thumbnails?page=${pageNum}&limit=20`);
        if (!res.ok) return;
        const data = (await res.json()) as ThumbmakerThumbnailsListResponse & {
          success?: boolean;
        };
        const items = data.data ?? [];
        setThumbnails((prev) => (append ? [...prev, ...items] : items));
        setHasMore(pageNum < (data.pagination?.totalPages ?? 1));
        pageRef.current = pageNum;
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [authFetch],
  );

  const { activeGenerations, trackGenerations, dismissGeneration } =
    useThumbnailGeneration({
      onComplete: () => {
        fetchThumbnails(1, false);
      },
    });

  useEffect(() => {
    fetchThumbnails();
  }, [fetchThumbnails]);

  const handleGenerationsStarted = useCallback(
    (generations: { id: string; status: string }[], prompt: string) => {
      trackGenerations(generations, prompt);
    },
    [trackGenerations],
  );

  const handleDelete = useCallback(
    async (generationId: string) => {
      try {
        const res = await authFetch(`/api/thumbnails/${generationId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setThumbnails((prev) => prev.filter((t) => t.id !== generationId));
          dismissGeneration(generationId);
          toast.success("Thumbnail deleted");
          return;
        }
        toast.error("Failed to delete thumbnail");
      } catch {
        toast.error("Failed to delete thumbnail");
      }
    },
    [authFetch, dismissGeneration],
  );

  const loadMore = useCallback(() => {
    if (fetchingRef.current || !hasMore) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    const next = pageRef.current + 1;
    fetchThumbnails(next, true).finally(() => {
      setLoadingMore(false);
      fetchingRef.current = false;
    });
  }, [hasMore, fetchThumbnails]);

  const { ref: sentinelRef } = useInView({
    rootMargin: "200px",
    skip: loading || loadingMore || !hasMore,
    onChange: (inView) => {
      if (inView) loadMore();
    },
  });

  const activeIds = new Set(activeGenerations.map((g) => g.id));
  const fetchedIds = new Set(thumbnails.map((t) => t.id));
  const pendingActive = activeGenerations.filter(
    (g) => !fetchedIds.has(g.id) && g.status !== "COMPLETED",
  );

  const allCards: ThumbnailGenerationCardData[] = [
    ...pendingActive.map((g) => ({
      id: g.id,
      status: g.status,
      prompt: g.prompt,
      outputUrl: g.outputAsset?.url ?? null,
      thumbnailUrl: g.thumbnailAsset?.url ?? null,
      error: g.error,
    })),
    ...thumbnails.map((t) => {
      const active = activeIds.has(t.id)
        ? activeGenerations.find((a) => a.id === t.id)
        : undefined;
      const imageUrl = active?.outputAsset?.url ?? t.image ?? null;
      return {
        id: t.id,
        status: active?.status ?? t.status,
        prompt: t.title?.trim() || "Untitled thumbnail",
        outputUrl: imageUrl,
        thumbnailUrl: imageUrl,
        error: active?.error ?? t.error,
      };
    }),
  ];

  const isEmpty = allCards.length === 0;

  return (
    <>
      <div className="flex-1 overflow-auto">
        <div className="p-3 pb-44 sm:p-5 sm:pb-52">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-video" />
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <ImageSquare
                className="size-12 text-muted-foreground/40"
                weight="thin"
              />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  No thumbnails yet
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Add context and generate below
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {allCards.map((card) => {
                  const full = thumbnails.find((t) => t.id === card.id);
                  const active = activeGenerations.find(
                    (a) => a.id === card.id,
                  );
                  return (
                    <ThumbnailGenerationCard
                      key={card.id}
                      generation={card}
                      onDelete={handleDelete}
                      onDismiss={dismissGeneration}
                      onClick={() => {
                        setSelectedThumbnail({
                          id: card.id,
                          status: card.status,
                          prompt: card.prompt,
                          title: full?.title ?? null,
                          description: full?.description ?? null,
                          link: full?.link ?? null,
                          outputUrl: card.outputUrl,
                          thumbnailUrl: card.thumbnailUrl,
                          error: card.error,
                          createdAt:
                            full?.createdAt ??
                            active?.createdAt ??
                            new Date().toISOString(),
                        });
                      }}
                    />
                  );
                })}
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

      <ThumbnailDetailDialog
        thumbnail={selectedThumbnail}
        open={selectedThumbnail !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedThumbnail(null);
        }}
        onDelete={(id) => {
          handleDelete(id);
          setSelectedThumbnail(null);
        }}
      />

      <ThumbPromptForm onGenerationsStarted={handleGenerationsStarted} />
    </>
  );
}
