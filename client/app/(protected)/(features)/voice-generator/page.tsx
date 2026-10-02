"use client";

import { Microphone } from "@phosphor-icons/react";
import { ToolEmpty, ToolPage } from "@/components/generator/tool-layout";
import { ErrorState } from "@/components/shared/states";
import { Spinner } from "@/components/ui/spinner";
import {
  VoiceGenerationCard,
  VoiceRowSkeleton,
  type VoiceCardData,
} from "@/components/voice-generator/generation-card";
import { VoiceCloneList } from "@/components/voice-generator/voice-clone-list";
import { VoiceGenerationForm } from "@/components/voice-generator/voice-generation-form";
import { usePagedList } from "@/hooks/use-paged-list";
import { useVoiceClones } from "@/hooks/use-voice-clones";
import {
  useVoiceGeneration,
  voiceGenerationQueryKeys,
} from "@/hooks/use-voice-generation";

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

const LIST_CLASS = "grid gap-2 @3xl:grid-cols-2 @7xl:grid-cols-3";

export default function VoiceGeneratorPage() {
  const { catalog } = useVoiceClones();
  const history = usePagedList<
    VoiceGeneration,
    { generations?: VoiceGeneration[]; pagination?: { hasNextPage?: boolean } }
  >({
    queryKey: voiceGenerationQueryKeys.list(),
    path: (page) => `/api/voice-generations/all?page=${page}&limit=20`,
    select: (body) => ({
      items: body.generations,
      hasNextPage: body.pagination?.hasNextPage,
    }),
    loadError: "Couldn't load your voiceovers. Try again.",
    remove: {
      path: (id) => `/api/voice-generations/${id}`,
      success: "Voiceover deleted",
      error: "Couldn't delete the voiceover. Try again.",
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

  const { activeGenerations, submitGeneration, dismissGeneration } =
    useVoiceGeneration({ onComplete: () => void invalidate() });

  function voiceName(voiceId: string) {
    return (
      catalog.presets.find((v) => v.id === voiceId)?.label ??
      catalog.elevenV3.find((v) => v.id === voiceId)?.label ??
      catalog.clones.find((c) => c.id === voiceId)?.name ??
      voiceId.replace(/_/g, " ")
    );
  }

  function toCard(g: {
    id: string;
    status: string;
    text: string;
    voiceId: string;
    emotion?: string;
    outputAsset?: { url: string } | null;
    error?: string | null;
    createdAt: string;
  }): VoiceCardData {
    return {
      id: g.id,
      status: g.status,
      text: g.text,
      meta: [voiceName(g.voiceId), g.emotion].filter(Boolean).join(" · "),
      outputUrl: g.outputAsset?.url,
      error: g.error,
      createdAt: g.createdAt,
    };
  }

  const activeIds = new Set(activeGenerations.map((g) => g.id));
  const activeCards = activeGenerations.map(toCard);
  const historyCards = items.filter((g) => !activeIds.has(g.id)).map(toCard);
  const isEmpty = activeCards.length === 0 && historyCards.length === 0;

  return (
    <ToolPage className="p-0 sm:p-0 lg:flex lg:items-start">
      <aside className="border-b lg:sticky lg:top-14 lg:h-[calc(100svh-3.5rem)] lg:w-95 lg:shrink-0 lg:border-r lg:border-b-0">
        <VoiceGenerationForm
          onSubmit={async (payload) => {
            await submitGeneration(payload);
          }}
        >
          <section className="space-y-3">
            <h2 className="text-sm font-medium">Your cloned voices</h2>
            <VoiceCloneList />
          </section>
        </VoiceGenerationForm>
      </aside>

      <section
        aria-label="Voiceovers"
        className="@container min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-6"
      >
        {isLoading && activeCards.length === 0 ? (
          <div className={LIST_CLASS}>
            {Array.from({ length: 8 }).map((_, i) => (
              <VoiceRowSkeleton key={i} />
            ))}
          </div>
        ) : isError && activeCards.length === 0 ? (
          <ErrorState
            title="Couldn't load your voiceovers"
            description={error?.message}
            onRetry={() => void refetch()}
          />
        ) : isEmpty ? (
          <ToolEmpty
            icon={Microphone}
            title="No voiceovers yet"
            description="Pick a voice, write a script and generate speech."
          />
        ) : (
          <>
            <div className={LIST_CLASS}>
              {activeCards.map((card) => (
                <VoiceGenerationCard
                  key={card.id}
                  generation={card}
                  onDismiss={dismissGeneration}
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
