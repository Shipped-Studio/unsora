"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { Waveform, ArrowsClockwise } from "@phosphor-icons/react";
import {
  VoiceChangerForm,
  type VoiceConversionPayload,
} from "@/components/voice-generator/voice-changer-form";
import { VoiceGenerationCard } from "@/components/voice-generator/generation-card";
import type { VoiceCardData } from "@/components/voice-generator/generation-card";
import { useVoiceConversion } from "@/hooks/use-voice-conversion";
import { useVoiceClones } from "@/hooks/use-voice-clones";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface VoiceConversion {
  id: string;
  status: string;
  voiceId: string;
  outputAsset?: { id: string; url: string } | null;
  error?: string | null;
  createdAt: string;
}

export default function VoiceChangerPage() {
  const { authFetch } = useAuthFetch();
  const { catalog } = useVoiceClones();
  const [conversions, setConversions] = useState<VoiceConversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pageRef = useRef(1);
  const fetchingRef = useRef(false);

  const fetchConversions = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        const res = await authFetch(
          `/api/voice-conversions/all?page=${pageNum}&limit=20`,
        );
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        if (data.success) {
          setConversions((prev) =>
            append ? [...prev, ...data.conversions] : data.conversions,
          );
          setHasMore(data.pagination.hasNextPage);
          pageRef.current = pageNum;
        }
      } catch {
        if (!append) setConversions([]);
      } finally {
        setLoading(false);
      }
    },
    [authFetch],
  );

  const { activeConversions, submitConversion, dismissConversion } =
    useVoiceConversion({
      onComplete: () => fetchConversions(1, false),
    });

  useEffect(() => {
    fetchConversions();
  }, [fetchConversions]);

  const resolveVoiceName = useCallback(
    (voiceId: string) =>
      catalog.clones.find((c) => c.id === voiceId)?.name ?? voiceId,
    [catalog],
  );

  const handleSubmit = useCallback(
    async (payload: VoiceConversionPayload) => {
      setSubmitting(true);
      try {
        await submitConversion(payload);
      } finally {
        setSubmitting(false);
      }
    },
    [submitConversion],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const res = await authFetch(`/api/voice-conversions/${id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setConversions((prev) => prev.filter((c) => c.id !== id));
          toast.success("Conversion deleted");
        }
      } catch {
        toast.error("Failed to delete");
      }
    },
    [authFetch],
  );

  const loadMore = useCallback(() => {
    if (fetchingRef.current || !hasMore) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    fetchConversions(pageRef.current + 1, true).finally(() => {
      fetchingRef.current = false;
      setLoadingMore(false);
    });
  }, [fetchConversions, hasMore]);

  const { ref: loadMoreRef } = useInView({
    onChange: (inView) => {
      if (inView) loadMore();
    },
  });

  const activeIds = new Set(activeConversions.map((c) => c.id));
  const toCard = (c: {
    id: string;
    status: string;
    voiceId: string;
    outputAsset?: { url: string } | null;
    error?: string | null;
    createdAt?: string;
  }): VoiceCardData => ({
    id: c.id,
    status: c.status,
    text: "Voice conversion",
    voiceId: c.voiceId,
    voiceName: resolveVoiceName(c.voiceId),
    outputUrl: c.outputAsset?.url,
    error: c.error,
    createdAt: c.createdAt,
  });

  const allCards = [
    ...activeConversions.map(toCard),
    ...conversions.filter((c) => !activeIds.has(c.id)).map(toCard),
  ];
  const isEmpty = !loading && allCards.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:max-h-[calc(100vh-64px)] lg:flex-row">
      <VoiceChangerForm onSubmit={handleSubmit} isSubmitting={submitting} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 bg-card items-center justify-between border-b px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <Waveform className="size-4 text-primary" weight="duotone" />
            <h2 className="text-sm font-semibold">Conversions</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLoading(true);
              fetchConversions(1, false);
            }}
          >
            <ArrowsClockwise className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Waveform
                className="mb-3 size-10 text-muted-foreground/40"
                weight="duotone"
              />
              <p className="text-sm font-medium text-muted-foreground">
                No conversions yet
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground/80">
                Upload audio and pick a cloned voice to transform it.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {allCards.map((card) => (
                <VoiceGenerationCard
                  key={card.id}
                  generation={card}
                  onDelete={handleDelete}
                  onDismiss={dismissConversion}
                />
              ))}
            </div>
          )}

          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-6">
              {loadingMore && <Spinner className="size-5" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
