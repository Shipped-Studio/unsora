"use client";

import { Waveform } from "@phosphor-icons/react";
import { ToolEmpty, ToolPage } from "@/components/generator/tool-layout";
import { ErrorState } from "@/components/shared/states";
import { Spinner } from "@/components/ui/spinner";
import {
  VoiceGenerationCard,
  VoiceRowSkeleton,
  type VoiceCardData,
} from "@/components/voice-generator/generation-card";
import { VoiceChangerForm } from "@/components/voice-generator/voice-changer-form";
import { usePagedList } from "@/hooks/use-paged-list";
import { useVoiceClones } from "@/hooks/use-voice-clones";
import {
  useVoiceConversion,
  voiceConversionQueryKeys,
} from "@/hooks/use-voice-conversion";

interface VoiceConversion {
  id: string;
  status: string;
  voiceId: string;
  outputAsset?: { id: string; url: string } | null;
  error?: string | null;
  createdAt: string;
}

const LIST_CLASS = "grid gap-2 @3xl:grid-cols-2 @7xl:grid-cols-3";

export default function VoiceChangerPage() {
  const { catalog } = useVoiceClones();
  const history = usePagedList<
    VoiceConversion,
    { conversions?: VoiceConversion[]; pagination?: { hasNextPage?: boolean } }
  >({
    queryKey: voiceConversionQueryKeys.list(),
    path: (page) => `/api/voice-conversions/all?page=${page}&limit=20`,
    select: (body) => ({
      items: body.conversions,
      hasNextPage: body.pagination?.hasNextPage,
    }),
    loadError: "Couldn't load your recordings. Try again.",
    remove: {
      path: (id) => `/api/voice-conversions/${id}`,
      success: "Recording deleted",
      error: "Couldn't delete the recording. Try again.",
    },
  });
  const {
    items,
    isLoading,
    isError,
    error,
    refetch,
    invalidate,
    deleteItem,
    hasNextPage,
    isFetchingNextPage,
    loadMoreSentinel,
  } = history;

  const { activeConversions, submitConversion, dismissConversion } =
    useVoiceConversion({ onComplete: () => void invalidate() });

  function toCard(c: {
    id: string;
    status: string;
    voiceId: string;
    outputAsset?: { url: string } | null;
    error?: string | null;
    createdAt: string;
  }): VoiceCardData {
    const voiceName =
      catalog.clones.find((clone) => clone.id === c.voiceId)?.name ??
      "Cloned voice";
    return {
      id: c.id,
      status: c.status,
      text: `Changed to ${voiceName}`,
      meta: new Date(c.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      outputUrl: c.outputAsset?.url,
      error: c.error,
      createdAt: c.createdAt,
    };
  }

  const activeIds = new Set(activeConversions.map((c) => c.id));
  const activeCards = activeConversions.map(toCard);
  const historyCards = items.filter((c) => !activeIds.has(c.id)).map(toCard);
  const isEmpty = activeCards.length === 0 && historyCards.length === 0;

  return (
    <ToolPage className="p-0 sm:p-0 lg:flex lg:items-start">
      <aside className="border-b lg:sticky lg:top-14 lg:h-[calc(100svh-3.5rem)] lg:w-95 lg:shrink-0 lg:border-r lg:border-b-0">
        <VoiceChangerForm
          onSubmit={async (payload) => {
            await submitConversion(payload);
          }}
        />
      </aside>

      <section
        aria-label="Recordings"
        className="@container min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-6"
      >
        {isLoading && activeCards.length === 0 ? (
          <div className={LIST_CLASS}>
            {Array.from({ length: 6 }).map((_, i) => (
              <VoiceRowSkeleton key={i} />
            ))}
          </div>
        ) : isError && activeCards.length === 0 ? (
          <ErrorState
            title="Couldn't load your recordings"
            description={error?.message}
            onRetry={() => void refetch()}
          />
        ) : isEmpty ? (
          <ToolEmpty
            icon={Waveform}
            title="No recordings yet"
            description="Upload a recording and pick one of your cloned voices."
          />
        ) : (
          <>
            <div className={LIST_CLASS}>
              {activeCards.map((card) => (
                <VoiceGenerationCard
                  key={card.id}
                  generation={card}
                  onDismiss={dismissConversion}
                />
              ))}
              {historyCards.map((card) => (
                <VoiceGenerationCard
                  key={card.id}
                  generation={card}
                  onDelete={(id) => void deleteItem(id)}
                />
              ))}
            </div>
            {hasNextPage ? (
              <div ref={loadMoreSentinel} className="flex justify-center py-6">
                {isFetchingNextPage ? (
                  <Spinner className="text-muted-foreground" />
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>
    </ToolPage>
  );
}
