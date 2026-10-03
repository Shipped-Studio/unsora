"use client";

import { MusicNotes } from "@phosphor-icons/react";
import {
  ToolEmpty,
  ToolPage,
  ToolPane,
  ToolSidebar,
} from "@/components/generator/tool-layout";
import {
  AudioRowSkeleton,
  MusicGenerationCard,
  type MusicCardData,
} from "@/components/music-generator/generation-card";
import { MusicGenerationForm } from "@/components/music-generator/music-generation-form";
import { ErrorState } from "@/components/shared/states";
import { Spinner } from "@/components/ui/spinner";
import { useMusicPlayer } from "@/contexts/music-player-context";
import {
  musicGenerationQueryKeys,
  useMusicGeneration,
} from "@/hooks/use-music-generation";
import { usePagedList } from "@/hooks/use-paged-list";

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

function toCard(g: MusicGeneration): MusicCardData {
  return {
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
  };
}

const LIST_CLASS = "grid grid-cols-1 gap-2 @3xl:grid-cols-2 @7xl:grid-cols-3";

export default function MusicGeneratorPage() {
  const { currentTrack, stop } = useMusicPlayer();
  const history = usePagedList<
    MusicGeneration,
    { generations?: MusicGeneration[]; pagination?: { hasNextPage?: boolean } }
  >({
    queryKey: musicGenerationQueryKeys.list(),
    path: (page) => `/api/music-generations/all?page=${page}&limit=20`,
    select: (body) => ({
      items: body.generations,
      hasNextPage: body.pagination?.hasNextPage,
    }),
    loadError: "Couldn't load your songs. Try again.",
    remove: {
      path: (id) => `/api/music-generations/${id}`,
      success: "Song deleted",
      error: "Couldn't delete the song. Try again.",
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
    useMusicGeneration({ onComplete: () => void invalidate() });

  async function handleDelete(id: string) {
    const deleted = await deleteItem(id);
    if (deleted && currentTrack?.id === id) stop();
  }

  const activeIds = new Set(activeGenerations.map((g) => g.id));
  const activeCards = activeGenerations.map(toCard);
  const historyCards = items.filter((g) => !activeIds.has(g.id)).map(toCard);
  const isEmpty = activeCards.length === 0 && historyCards.length === 0;

  return (
    <ToolPage className="p-0 sm:p-0 lg:flex-row lg:items-start">
      <ToolSidebar>
        <MusicGenerationForm
          onSubmit={async (payload) => {
            await submitGeneration(payload);
          }}
        />
      </ToolSidebar>

      <ToolPane label="Songs">
        {isLoading && activeCards.length === 0 ? (
          <div className={LIST_CLASS}>
            {Array.from({ length: 8 }).map((_, i) => (
              <AudioRowSkeleton key={i} />
            ))}
          </div>
        ) : isError && activeCards.length === 0 ? (
          <ErrorState
            title="Couldn't load your songs"
            description={error?.message}
            onRetry={() => void refetch()}
          />
        ) : isEmpty ? (
          <ToolEmpty
            icon={MusicNotes}
            title="No songs yet"
            description="Write some lyrics, pick a style and generate a song."
          />
        ) : (
          <>
            <div className={LIST_CLASS}>
              {activeCards.map((card) => (
                <MusicGenerationCard
                  key={card.id}
                  generation={card}
                  onDismiss={dismissGeneration}
                />
              ))}
              {historyCards.map((card) => (
                <MusicGenerationCard
                  key={card.id}
                  generation={card}
                  onDelete={(id) => void handleDelete(id)}
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
      </ToolPane>
    </ToolPage>
  );
}
