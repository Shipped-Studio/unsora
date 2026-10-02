"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { VideoPromptForm } from "@/components/video-generator/prompt-form";
import {
  VideoCard,
  type CardGeneration,
} from "@/components/video-generator/video-card";
import { VideoDetailDialog } from "@/components/video-generator/video-detail-dialog";
import { useVideoGeneration } from "@/hooks/use-video-generation";
import {
  useGenerations,
  useDeleteGeneration,
  generationQueryKeys,
} from "@/hooks/use-generations-query";
import { Skeleton } from "@/components/ui/skeleton";

export default function VideoGeneratorPage() {
  const queryClient = useQueryClient();
  const { activeGenerations, submit } = useVideoGeneration();
  const { data, isLoading } = useGenerations(1, 12);
  const deleteGeneration = useDeleteGeneration();
  const generations = data?.generations ?? [];

  const [selectedGeneration, setSelectedGeneration] =
    useState<CardGeneration | null>(null);

  const completedIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const gen of activeGenerations) {
      if (gen.status === "COMPLETED" && !completedIds.current.has(gen.id)) {
        completedIds.current.add(gen.id);
        queryClient.invalidateQueries({
          queryKey: generationQueryKeys.lists(),
        });
        break;
      }
    }
  }, [activeGenerations, queryClient]);

  const activeIds = new Set(activeGenerations.map((g) => g.id));
  const historyGenerations = generations.filter((g) => !activeIds.has(g.id));

  const isEmpty =
    activeGenerations.length === 0 &&
    historyGenerations.length === 0 &&
    !isLoading;

  return (
    <>
      <div className="flex-1 overflow-auto">
        {isLoading && historyGenerations.length === 0 && activeGenerations.length === 0 ? (
          <div className="grid grid-cols-2 gap-3 p-3 pb-44 sm:grid-cols-3 sm:p-5 sm:pb-52">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={`init-skeleton-${i}`} className="aspect-video" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-muted-foreground">
            <span className="text-sm">No videos yet. Start generating!</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-3 pb-44 sm:grid-cols-3 sm:p-5 sm:pb-52">
            {activeGenerations.map((gen) => {
              const card: CardGeneration = {
                ...gen,
                outputUrl: gen.outputAsset?.url ?? null,
                thumbnailUrl: gen.thumbnailAsset?.url ?? null,
                error: gen.error ?? null,
              };
              return (
                <VideoCard
                  key={gen.id}
                  generation={card}
                  displayMode="asset"
                  onClick={() => setSelectedGeneration(card)}
                  onDelete={(id) => deleteGeneration.mutate(id)}
                />
              );
            })}
            {historyGenerations.map((gen) => {
              const card: CardGeneration = {
                id: gen.id,
                status: gen.status,
                model: gen.model,
                prompt: gen.prompt,
                outputUrl: gen.outputAsset?.url ?? null,
                thumbnailUrl: gen.thumbnailAsset?.url ?? null,
                error: gen.error ?? null,
                duration: gen.duration,
                ratio: gen.ratio,
                createdAt: gen.createdAt,
              };
              return (
                <VideoCard
                  key={gen.id}
                  generation={card}
                  displayMode="asset"
                  onClick={() => setSelectedGeneration(card)}
                  onDelete={(id) => deleteGeneration.mutate(id)}
                />
              );
            })}
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={`skeleton-${i}`} className="aspect-video" />
              ))}
          </div>
        )}
      </div>

      <VideoDetailDialog
        generation={selectedGeneration}
        open={selectedGeneration !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedGeneration(null);
        }}
        onDelete={(id) => {
          deleteGeneration.mutate(id);
          setSelectedGeneration(null);
        }}
      />

      <VideoPromptForm onSubmit={submit} />
    </>
  );
}
