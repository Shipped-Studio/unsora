"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { UserFocus, ArrowsClockwise } from "@phosphor-icons/react";
import {
  AvatarPromptForm,
  type AvatarGenerationPayload,
} from "@/components/avatar-maker/prompt-form";
import {
  AvatarGenerationCard,
  type AvatarCardData,
} from "@/components/avatar-maker/generation-card";
import { useAvatarGeneration } from "@/hooks/use-avatar-generation";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCdnUrl } from "@/lib/video-utils";
import { toast } from "sonner";

interface AvatarGeneration {
  id: string;
  status: string;
  transcript: string;
  emotion: string;
  model: string;
  outputAsset?: { id: string; url: string } | null;
  error?: string | null;
  createdAt: string;
}

export default function AiAvatarMakerPage() {
  const { authFetch } = useAuthFetch();
  const [generations, setGenerations] = useState<AvatarGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<AvatarCardData | null>(null);
  const pageRef = useRef(1);
  const fetchingRef = useRef(false);

  const fetchGenerations = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        const res = await authFetch(
          `/api/avatar-generations/all?page=${pageNum}&limit=20`,
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
    useAvatarGeneration({
      onComplete: () => {
        fetchGenerations(1, false);
      },
    });

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  const handleSubmit = useCallback(
    async (payload: AvatarGenerationPayload) => {
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
        const res = await authFetch(
          `/api/avatar-generations/${generationId}`,
          { method: "DELETE" },
        );
        if (res.ok) {
          setGenerations((prev) => prev.filter((g) => g.id !== generationId));
          if (playingVideo?.id === generationId) setPlayingVideo(null);
          toast.success("Avatar deleted");
        }
      } catch {
        toast.error("Failed to delete avatar");
      }
    },
    [authFetch, playingVideo?.id],
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
  const historyCards: AvatarCardData[] = generations
    .filter((g) => !activeIds.has(g.id))
    .map((g) => ({
      id: g.id,
      status: g.status,
      transcript: g.transcript,
      emotion: g.emotion,
      outputUrl: g.outputAsset?.url,
      error: g.error,
      createdAt: g.createdAt,
    }));

  const activeCards: AvatarCardData[] = activeGenerations.map((g) => ({
    id: g.id,
    status: g.status,
    transcript: g.transcript,
    emotion: g.emotion,
    outputUrl: g.outputAsset?.url,
    error: g.error,
    createdAt: g.createdAt,
  }));

  const allCards = [...activeCards, ...historyCards];
  const isEmpty = !loading && allCards.length === 0;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b px-3 py-3 sm:px-5">
          <h2 className="text-sm font-semibold">Your avatars</h2>
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

        <div className="flex-1 overflow-y-auto p-3 pb-44 sm:p-5 sm:pb-52">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center text-muted-foreground">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                <UserFocus
                  className="size-7 text-muted-foreground/50"
                  weight="duotone"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  No avatar videos yet
                </p>
                <p className="mt-1 max-w-[280px] text-xs text-muted-foreground/70">
                  Pick a portrait, write a script, and generate a lip-synced
                  talking avatar with SkyReels V3
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {allCards.map((gen) => (
                  <AvatarGenerationCard
                    key={gen.id}
                    generation={gen}
                    onDelete={handleDelete}
                    onDismiss={dismissGeneration}
                    onPlay={setPlayingVideo}
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

      <AvatarPromptForm onSubmit={handleSubmit} isSubmitting={submitting} />

      <Dialog
        open={!!playingVideo?.outputUrl}
        onOpenChange={(open) => !open && setPlayingVideo(null)}
      >
        <DialogContent className="max-w-lg overflow-hidden p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle className="line-clamp-2 text-sm font-medium">
              {playingVideo?.transcript}
            </DialogTitle>
          </DialogHeader>
          {playingVideo?.outputUrl && (
            <video
              src={getCdnUrl(playingVideo.outputUrl)}
              controls
              autoPlay
              className="aspect-square w-full bg-black object-cover"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
