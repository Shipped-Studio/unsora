"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { MusicNotes, ArrowsClockwise } from "@phosphor-icons/react";
import {
  MusicGenerationForm,
  type MusicGenerationPayload,
} from "@/components/music-generator/music-generation-form";
import {
  MusicGenerationCard,
  type MusicCardData,
} from "@/components/music-generator/generation-card";
import { useMusicGeneration } from "@/hooks/use-music-generation";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useMusicPlayer } from "@/contexts/music-player-context";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface MusicGeneration {
  id: string;
  status: string;
  lyrics: string;
  prompt: string;
  model: string;
  trackNumber?: number;
  songTitle?: string;
  outputAsset?: { id: string; url: string } | null;
  error?: string | null;
  createdAt: string;
}

export default function MusicGeneratorPage() {
  const { authFetch } = useAuthFetch();
  const { currentTrack, stop } = useMusicPlayer();
  const [generations, setGenerations] = useState<MusicGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pageRef = useRef(1);
  const fetchingRef = useRef(false);

  const fetchGenerations = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        const res = await authFetch(
          `/api/music-generations/all?page=${pageNum}&limit=20`,
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
    useMusicGeneration({
      onComplete: () => {
        fetchGenerations(1, false);
      },
    });

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  const handleSubmit = useCallback(
    async (payload: MusicGenerationPayload) => {
      setSubmitting(true);
      try {
        await submitGeneration(payload);
      } finally {
        setSubmitting(false);
      }
    },
    [submitGeneration],
  );

  const handleDelete = useCallback(
    async (generationId: string) => {
      try {
        const res = await authFetch(`/api/music-generations/${generationId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setGenerations((prev) => prev.filter((g) => g.id !== generationId));
          if (currentTrack?.id === generationId) {
            stop();
          }
          toast.success("Song deleted");
        }
      } catch {
        toast.error("Failed to delete song");
      }
    },
    [authFetch, currentTrack?.id, stop],
  );

  const loadMore = useCallback(() => {
    if (fetchingRef.current || !hasMore) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    fetchGenerations(pageRef.current + 1, true).finally(() => {
      fetchingRef.current = false;
      setLoadingMore(false);
    });
  }, [fetchGenerations, hasMore]);

  const { ref: loadMoreRef } = useInView({
    onChange: (inView) => {
      if (inView) loadMore();
    },
  });

  const activeIds = new Set(activeGenerations.map((g) => g.id));
  const historyCards: MusicCardData[] = generations
    .filter((g) => !activeIds.has(g.id))
    .map((g) => ({
      id: g.id,
      status: g.status,
      lyrics: g.lyrics,
      prompt: g.prompt,
      model: g.model,
      trackNumber: g.trackNumber,
      songTitle: g.songTitle,
      outputUrl: g.outputAsset?.url,
      error: g.error,
      createdAt: g.createdAt,
    }));

  const activeCards: MusicCardData[] = activeGenerations.map((g) => ({
    id: g.id,
    status: g.status,
    lyrics: g.lyrics,
    prompt: g.prompt,
    model: g.model,
    trackNumber: g.trackNumber,
    songTitle: g.songTitle,
    outputUrl: g.outputAsset?.url,
    error: g.error,
    createdAt: g.createdAt,
  }));

  const allCards = [...activeCards, ...historyCards];
  const isEmpty = !loading && allCards.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:max-h-[calc(100vh-64px)] lg:flex-row">
      <MusicGenerationForm onSubmit={handleSubmit} isSubmitting={submitting} />

      <div className="flex flex-1 flex-col">
        <div className="flex bg-card items-center justify-between border-b px-3 py-3 sm:px-5">
          <h2 className="text-sm font-semibold">Results</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="h-8 gap-1.5 text-xs"
          >
            <ArrowsClockwise className="size-3.5" />
            Refresh
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          {loading ? (
            <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px] rounded-lg" />
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center text-muted-foreground">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                <MusicNotes
                  className="size-7 text-muted-foreground/50"
                  weight="duotone"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  No songs yet
                </p>
                <p className="mt-1 max-w-[260px] text-xs text-muted-foreground/70">
                  Fill in your lyrics (style prompt optional), then hit Generate
                  song to get started
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
                {allCards.map((gen) => (
                  <MusicGenerationCard
                    key={gen.id}
                    generation={gen}
                    onDelete={handleDelete}
                    onDismiss={dismissGeneration}
                  />
                ))}
              </div>
              {hasMore && (
                <div ref={loadMoreRef} className="flex justify-center py-6">
                  {loadingMore && <Spinner />}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
