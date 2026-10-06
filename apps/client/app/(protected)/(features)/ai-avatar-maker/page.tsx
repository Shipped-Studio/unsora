"use client";

import { useState } from "react";
import { DownloadSimple, UserSound } from "@phosphor-icons/react";
import {
  AvatarCardSkeleton,
  AvatarGenerationCard,
  type AvatarCardData,
} from "@/components/avatar-maker/generation-card";
import { AvatarPromptForm } from "@/components/avatar-maker/prompt-form";
import {
  ScheduleLink,
  ToolEmpty,
  ToolGrid,
  ToolPage,
} from "@/components/generator/tool-layout";
import { ErrorState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  avatarGenerationQueryKeys,
  useAvatarGeneration,
} from "@/hooks/use-avatar-generation";
import { usePagedList } from "@/hooks/use-paged-list";
import { getCdnUrl } from "@/lib/video-utils";

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

function toCard(g: {
  id: string;
  status: string;
  transcript: string;
  emotion?: string;
  outputAsset?: { url: string } | null;
  error?: string | null;
  createdAt: string;
}): AvatarCardData {
  return {
    id: g.id,
    status: g.status,
    transcript: g.transcript,
    emotion: g.emotion,
    outputUrl: g.outputAsset?.url,
    error: g.error,
    createdAt: g.createdAt,
  };
}

export default function AiAvatarMakerPage() {
  const [playing, setPlaying] = useState<AvatarCardData | null>(null);
  const history = usePagedList<
    AvatarGeneration,
    { generations?: AvatarGeneration[]; pagination?: { hasNextPage?: boolean } }
  >({
    queryKey: avatarGenerationQueryKeys.list(),
    path: (page) => `/api/avatar-generations/all?page=${page}&limit=20`,
    select: (body) => ({
      items: body.generations,
      hasNextPage: body.pagination?.hasNextPage,
    }),
    loadError: "Couldn't load your avatar videos. Try again.",
    remove: {
      path: (id) => `/api/avatar-generations/${id}`,
      success: "Video deleted",
      error: "Couldn't delete the video. Try again.",
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
    useAvatarGeneration({ onComplete: () => void invalidate() });

  async function handleDelete(id: string) {
    const deleted = await deleteItem(id);
    if (deleted && playing?.id === id) setPlaying(null);
  }

  const activeIds = new Set(activeGenerations.map((g) => g.id));
  const activeCards = activeGenerations.map(toCard);
  const historyCards = items.filter((g) => !activeIds.has(g.id)).map(toCard);
  const isEmpty = activeCards.length === 0 && historyCards.length === 0;
  const playingUrl = playing?.outputUrl ?? null;

  return (
    <ToolPage
      dock={
        <AvatarPromptForm
          onSubmit={async (payload) => {
            await submitGeneration(payload);
          }}
        />
      }
    >
      {isLoading && activeCards.length === 0 ? (
        <ToolGrid shape="square">
          {Array.from({ length: 8 }).map((_, i) => (
            <AvatarCardSkeleton key={i} />
          ))}
        </ToolGrid>
      ) : isError && activeCards.length === 0 ? (
        <ErrorState
          title="Couldn't load your avatar videos"
          description={error?.message}
          onRetry={() => void refetch()}
        />
      ) : isEmpty ? (
        <ToolEmpty
          showcase
          icon={UserSound}
          title="No avatar videos yet"
          description="Pick a portrait and write what it should say."
        />
      ) : (
        <>
          <ToolGrid shape="square">
            {activeCards.map((card) => (
              <AvatarGenerationCard
                key={card.id}
                generation={card}
                onPlay={setPlaying}
                onDismiss={dismissGeneration}
              />
            ))}
            {historyCards.map((card) => (
              <AvatarGenerationCard
                key={card.id}
                generation={card}
                onPlay={setPlaying}
                onDelete={(id) => void handleDelete(id)}
              />
            ))}
          </ToolGrid>
          {hasNextPage ? (
            <div ref={loadMoreSentinel} className="flex justify-center py-6">
              {isFetchingNextPage ? (
                <Spinner className="text-muted-foreground" />
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <Dialog
        open={playingUrl !== null}
        onOpenChange={(open) => {
          if (!open) setPlaying(null);
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="p-4 pr-12">
            <DialogTitle className="line-clamp-2 leading-snug">
              {playing?.transcript || "Avatar video"}
            </DialogTitle>
          </DialogHeader>
          {playingUrl ? (
            <>
              <video
                src={getCdnUrl(playingUrl)}
                controls
                autoPlay
                playsInline
                className="aspect-square w-full border-y bg-media object-contain"
              />
              <DialogFooter className="p-4">
                <a
                  href={getCdnUrl(playingUrl, { download: true })}
                  download
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <DownloadSimple />
                  Download
                </a>
                <ScheduleLink url={playingUrl} mediaType="video" variant="default" />
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </ToolPage>
  );
}
