"use client";

import { useMemo, useState } from "react";
import { VideoCamera } from "@phosphor-icons/react";
import { ToolPage } from "@/components/generator/tool-layout";
import { ToolResults } from "@/components/generator/tool-results";
import {
  MediaResultCard,
  isPending,
  type MediaResult,
} from "@/components/generator/media-result-card";
import {
  MediaResultDialog,
  detailRows,
  formatCredits,
} from "@/components/generator/media-result-dialog";
import { CatalogPromptForm } from "@/components/generator/catalog-prompt-form";
import { videoModelLabel } from "@/components/generator/model-labels";
import { useCatalogGeneration } from "@/hooks/use-catalog-generation";
import { useCatalogLabel } from "@/hooks/use-model-catalog";
import {
  useDeleteFromHistory,
  useGenerationHistory,
  useRefreshHistory,
  startedRecently,
} from "@/hooks/use-generation-history";

const TOOL = "video";
const LIST_PATH = "/api/v1/videos/all";
const DELETE_PATH = "/api/v1/videos";

interface VideoRecord {
  id: string;
  status: string;
  prompt: string;
  model: string;
  outputAsset?: { url: string } | null;
  thumbnailAsset?: { url: string } | null;
  error?: string | null;
  duration?: number | null;
  ratio?: string | null;
  creditsUsed?: number | null;
  createdAt: string;
}

interface VideoListResponse {
  generations?: VideoRecord[];
  pagination?: { hasNextPage?: boolean };
}

interface VideoItem extends MediaResult {
  model: string;
  duration?: number | null;
  ratio?: string | null;
  credits?: number | null;
  createdAt: string;
}

export default function VideoGeneratorPage() {
  const history = useGenerationHistory<VideoRecord>({
    tool: TOOL,
    path: LIST_PATH,
    parse: (body) => {
      const data = body as VideoListResponse;
      return {
        items: data.generations ?? [],
        hasNextPage: !!data.pagination?.hasNextPage,
      };
    },
    isInProgress: (g) => isPending(g.status) && startedRecently(g.createdAt),
  });
  const refreshHistory = useRefreshHistory(TOOL);
  const deleteVideo = useDeleteFromHistory({
    tool: TOOL,
    path: DELETE_PATH,
    noun: "video",
  });
  const { activeGenerations, submit, dismiss } = useCatalogGeneration("video", {
    onSettled: () => void refreshHistory(),
  });
  const catalogLabel = useCatalogLabel("video");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = useMemo<VideoItem[]>(() => {
    const historyIds = new Set(history.items.map((g) => g.id));
    const activeById = new Map(activeGenerations.map((g) => [g.id, g]));

    const fromActive = activeGenerations
      .filter((g) => !historyIds.has(g.id))
      .map<VideoItem>((g) => ({
        id: g.id,
        status: g.status,
        prompt: g.prompt,
        mediaType: "video",
        url: g.outputAsset?.url ?? null,
        thumbnailUrl: g.thumbnailAsset?.url ?? null,
        error: g.error ?? null,
        local: g.id.startsWith("temp-"),
        model: g.model,
        createdAt: g.createdAt,
      }));

    const fromHistory = history.items.map<VideoItem>((g) => {
      const active = activeById.get(g.id);
      return {
        id: g.id,
        status: active?.status ?? g.status,
        prompt: g.prompt,
        mediaType: "video",
        url: active?.outputAsset?.url ?? g.outputAsset?.url ?? null,
        thumbnailUrl:
          active?.thumbnailAsset?.url ?? g.thumbnailAsset?.url ?? null,
        error: active?.error ?? g.error ?? null,
        model: g.model,
        duration: g.duration,
        ratio: g.ratio,
        credits: g.creditsUsed,
        createdAt: g.createdAt,
      };
    });

    return [...fromActive, ...fromHistory];
  }, [activeGenerations, history.items]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  const handleDelete = (id: string) => {
    dismiss(id);
    deleteVideo.mutate(id);
  };

  return (
    <ToolPage
      dock={
        <CatalogPromptForm
          category="video"
          noun="video"
          defaultModel="seedance-2.5"
          placeholder="Describe the video"
          promptLabel="Video prompt"
          onSubmit={submit}
        />
      }
    >
      <ToolResults
        items={items}
        getKey={(item) => item.id}
        history={history}
        shape="video"
        aspectClassName="aspect-video"
        plural="videos"
        empty={{
          icon: VideoCamera,
          title: "No videos yet",
          description:
            "Describe a video below. Finished videos show up here and in your Library.",
        }}
        renderItem={(item) => (
          <MediaResultCard
            result={item}
            noun="video"
            aspectClassName="aspect-video"
            onOpen={() => setSelectedId(item.id)}
            onDelete={handleDelete}
            onDismiss={dismiss}
          />
        )}
      />

      <MediaResultDialog
        result={selected}
        noun="video"
        title="Video"
        createdAt={selected?.createdAt}
        details={
          selected
            ? detailRows([
                {
                  label: "Model",
                  value:
                    catalogLabel(selected.model) ??
                    videoModelLabel(selected.model),
                },
                {
                  label: "Duration",
                  value: selected.duration ? `${selected.duration}s` : null,
                },
                { label: "Aspect ratio", value: selected.ratio },
                { label: "Credits", value: formatCredits(selected.credits) },
              ])
            : []
        }
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onDelete={handleDelete}
      />
    </ToolPage>
  );
}
