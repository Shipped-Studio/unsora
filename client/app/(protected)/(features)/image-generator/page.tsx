"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { ImagePromptForm } from "@/components/image-generator/prompt-form";
import {
  GenerationCard,
  type GenerationCardData,
} from "@/components/image-generator/generation-card";
import {
  ImageDetailDialog,
  type ImageDetailData,
} from "@/components/image-generator/image-detail-dialog";
import { useImageGeneration } from "@/hooks/use-image-generation";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { ImageSquare } from "@phosphor-icons/react";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface AssetRef {
  id: string;
  url: string;
}

interface ImageGeneration {
  id: string;
  status: string;
  prompt: string;
  model: string;
  ratio: string;
  resolution: string;
  params?: Record<string, string> | null;
  outputAsset?: AssetRef | null;
  thumbnailAsset?: AssetRef | null;
  error?: string | null;
  createdAt: string;
}

export default function ImageGeneratorPage() {
  const { authFetch } = useAuthFetch();
  const [generations, setGenerations] = useState<ImageGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedGeneration, setSelectedGeneration] =
    useState<ImageDetailData | null>(null);
  const pageRef = useRef(1);
  const fetchingRef = useRef(false);

  const fetchGenerations = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        const res = await authFetch(
          `/api/image-generations/all?page=${pageNum}&limit=20`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.success) {
          setGenerations((prev) =>
            append ? [...prev, ...data.generations] : data.generations,
          );
          setHasMore(data.pagination.hasNextPage);
          pageRef.current = pageNum;
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [authFetch],
  );

  const { activeGenerations, submitGeneration, dismissGeneration } =
    useImageGeneration({
      onComplete: () => {
        fetchGenerations(1, false);
      },
    });

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  const handleSubmit = useCallback(
    async (params: {
      prompt: string;
      model: string;
      ratio: string;
      resolution?: string;
      quality?: string;
      nsfwChecker?: boolean;
      images?: string[];
      count: number;
    }) => {
      const { count, ...rest } = params;
      for (let i = 0; i < count; i++) {
        await submitGeneration(rest);
      }
      return null;
    },
    [submitGeneration],
  );

  const handleDelete = useCallback(
    async (generationId: string) => {
      try {
        const res = await authFetch(`/api/image-generations/${generationId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setGenerations((prev) => prev.filter((g) => g.id !== generationId));
          toast.success("Image deleted");
        }
      } catch {
        toast.error("Failed to delete image");
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

  // Active generations that haven't landed in the fetched list yet
  const activeIds = new Set(activeGenerations.map((g) => g.id));
  const fetchedIds = new Set(generations.map((g) => g.id));
  const pendingActive = activeGenerations.filter(
    (g) => !fetchedIds.has(g.id) && g.status !== "COMPLETED",
  );

  // Merge: active first, then fetched — single flat list
  const allCards: GenerationCardData[] = [
    ...pendingActive.map((g) => ({
      id: g.id,
      status: g.status,
      prompt: g.prompt,
      outputUrl: g.outputAsset?.url ?? null,
      thumbnailUrl: g.thumbnailAsset?.url ?? null,
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
        thumbnailUrl: active?.thumbnailAsset?.url ?? g.thumbnailAsset?.url ?? null,
        error: active?.error ?? g.error,
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
                <Skeleton key={i} className="aspect-square" />
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
                  No images yet
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Describe an image below to get started
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {allCards.map((card) => {
                  const full = generations.find((g) => g.id === card.id);
                  return (
                    <GenerationCard
                      key={card.id}
                      generation={card}
                      displayMode="asset"
                      onDelete={handleDelete}
                      onDismiss={dismissGeneration}
                      onClick={() => {
                        if (full) {
                          setSelectedGeneration({
                            ...card,
                            model: full.model,
                            type: "BASIC",
                            ratio: full.ratio,
                            resolution: full.resolution,
                            params: full.params,
                            createdAt: full.createdAt,
                          });
                        }
                      }}
                    />
                  );
                })}
              </div>
              {hasMore && (
                <div
                  ref={sentinelRef}
                  className="flex justify-center py-6"
                >
                  {loadingMore && (
                    <Spinner className="size-5 text-muted-foreground" />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ImageDetailDialog
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

      <ImagePromptForm onSubmit={handleSubmit} />
    </>
  );
}
