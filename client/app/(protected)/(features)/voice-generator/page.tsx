"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { Microphone, ArrowsClockwise } from "@phosphor-icons/react";
import { VoiceGenerationForm,
  type VoiceGenerationPayload,
} from "@/components/voice-generator/voice-generation-form";
import { VoiceCloneList } from "@/components/voice-generator/voice-clone-list";
import {
  VoiceGenerationCard,
  type VoiceCardData,
} from "@/components/voice-generator/generation-card";
import { useVoiceGeneration } from "@/hooks/use-voice-generation";
import { useVoiceClones } from "@/hooks/use-voice-clones";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface VoiceGeneration {
  id: string;
  status: string;
  text: string;
  voiceId: string;
  emotion: string;
  model: string;
  outputAsset?: { id: string; url: string } | null;
  error?: string | null;
  createdAt: string;
}

export default function VoiceGeneratorPage() {
  const { authFetch } = useAuthFetch();
  const { catalog } = useVoiceClones();
  const [generations, setGenerations] = useState<VoiceGeneration[]>([]);
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
          `/api/voice-generations/all?page=${pageNum}&limit=20`,
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
    useVoiceGeneration({
      onComplete: () => {
        fetchGenerations(1, false);
      },
    });

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  const handleSubmit = useCallback(
    async (payload: VoiceGenerationPayload) => {
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
          `/api/voice-generations/${generationId}`,
          { method: "DELETE" },
        );
        if (res.ok) {
          setGenerations((prev) => prev.filter((g) => g.id !== generationId));
          toast.success("Voice clip deleted");
        }
      } catch {
        toast.error("Failed to delete voice clip");
      }
    },
    [authFetch],
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

  const resolveVoiceName = useCallback(
    (voiceId: string) => {
      const preset = catalog.presets.find((p) => p.id === voiceId);
      if (preset) return preset.label;
      const elevenVoice = catalog.elevenV3.find((v) => v.id === voiceId);
      if (elevenVoice) return elevenVoice.label;
      const clone = catalog.clones.find((c) => c.id === voiceId);
      if (clone) return clone.name;
      return voiceId;
    },
    [catalog],
  );

  const activeIds = new Set(activeGenerations.map((g) => g.id));
  const historyCards: VoiceCardData[] = generations
    .filter((g) => !activeIds.has(g.id))
    .map((g) => ({
      id: g.id,
      status: g.status,
      text: g.text,
      voiceId: g.voiceId,
      voiceName: resolveVoiceName(g.voiceId),
      emotion: g.emotion,
      outputUrl: g.outputAsset?.url,
      error: g.error,
      createdAt: g.createdAt,
    }));

  const activeCards: VoiceCardData[] = activeGenerations.map((g) => ({
    id: g.id,
    status: g.status,
    text: g.text,
    voiceId: g.voiceId,
    voiceName: resolveVoiceName(g.voiceId),
    emotion: g.emotion,
    outputUrl: g.outputAsset?.url,
    error: g.error,
    createdAt: g.createdAt,
  }));

  const allCards = [...activeCards, ...historyCards];
  const isEmpty = !loading && allCards.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:max-h-[calc(100vh-64px)] lg:flex-row">
      <div className="flex min-h-0 flex-col lg:w-95 lg:shrink-0 lg:overflow-y-auto">
        <VoiceGenerationForm onSubmit={handleSubmit} isSubmitting={submitting} />
        <div className="border-b bg-card px-4 pb-4 lg:border-b-0 lg:border-r lg:px-5">
          <p className="mb-2 text-xs font-medium text-foreground">
            Your cloned voices
          </p>
          <VoiceCloneList />
        </div>
      </div>

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
                <Microphone
                  className="size-7 text-muted-foreground/50"
                  weight="duotone"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  No voice clips yet
                </p>
                <p className="mt-1 max-w-[260px] text-xs text-muted-foreground/70">
                  Choose a voice, paste your script, and generate natural
                  speech in seconds
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
                {allCards.map((gen) => (
                  <VoiceGenerationCard
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
