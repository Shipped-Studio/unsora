"use client";

import { useCallback, useMemo, useState } from "react";
import { FilmSlate } from "@phosphor-icons/react";
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
import {
  MoviePromptForm,
  type MovieMaterialsSubmitPayload,
} from "@/components/movie-materials-generator/prompt-form";
import {
  modeLabel,
  paramDetails,
} from "@/components/movie-materials-generator/modes";
import { useMovieMaterials } from "@/hooks/use-movie-materials";
import {
  useDeleteFromHistory,
  useGenerationHistory,
  useRefreshHistory,
  startedRecently,
} from "@/hooks/use-generation-history";

const TOOL = "movie-materials";
const PATH = "/api/movie-materials";

interface MovieMaterialRecord {
  id: string;
  status: string;
  prompt: string;
  mode?: string | null;
  ratio?: string | null;
  resolution?: string | null;
  params?: Record<string, unknown> | null;
  outputAsset?: { url: string } | null;
  thumbnailAsset?: { url: string } | null;
  error?: string | null;
  creditsUsed?: number | null;
  createdAt: string;
}

interface MovieMaterialListResponse {
  generations?: MovieMaterialRecord[];
  pagination?: { hasNextPage?: boolean };
}

interface MovieMaterialItem extends MediaResult {
  mode?: string | null;
  ratio?: string | null;
  resolution?: string | null;
  params?: Record<string, unknown> | null;
  credits?: number | null;
  createdAt: string;
}

export default function MovieMaterialsGeneratorPage() {
  const history = useGenerationHistory<MovieMaterialRecord>({
    tool: TOOL,
    path: `${PATH}/all`,
    parse: (body) => {
      const data = body as MovieMaterialListResponse;
      return {
        items: data.generations ?? [],
        hasNextPage: !!data.pagination?.hasNextPage,
      };
    },
    isInProgress: (g) => isPending(g.status) && startedRecently(g.createdAt),
  });
  const refreshHistory = useRefreshHistory(TOOL);
  const deleteImage = useDeleteFromHistory({
    tool: TOOL,
    path: PATH,
    noun: "image",
  });
  const { activeGenerations, submit, dismiss } = useMovieMaterials({
    onComplete: () => void refreshHistory(),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async ({ count, ...payload }: MovieMaterialsSubmitPayload) => {
      for (let i = 0; i < count; i++) {
        await submit(payload);
      }
    },
    [submit],
  );

  const items = useMemo<MovieMaterialItem[]>(() => {
    const historyIds = new Set(history.items.map((g) => g.id));
    const activeById = new Map(activeGenerations.map((g) => [g.id, g]));

    const fromActive = activeGenerations
      .filter((g) => !historyIds.has(g.id))
      .map<MovieMaterialItem>((g) => ({
        id: g.id,
        status: g.status,
        prompt: g.prompt,
        mediaType: "image",
        url: g.outputAsset?.url ?? null,
        thumbnailUrl: g.thumbnailAsset?.url ?? null,
        error: g.error ?? null,
        local: g.id.startsWith("temp-"),
        mode: g.mode,
        createdAt: g.createdAt,
      }));

    const fromHistory = history.items.map<MovieMaterialItem>((g) => {
      const active = activeById.get(g.id);
      return {
        id: g.id,
        status: active?.status ?? g.status,
        prompt: g.prompt,
        mediaType: "image",
        url: active?.outputAsset?.url ?? g.outputAsset?.url ?? null,
        thumbnailUrl:
          active?.thumbnailAsset?.url ?? g.thumbnailAsset?.url ?? null,
        error: active?.error ?? g.error ?? null,
        mode: g.mode,
        ratio: g.ratio,
        resolution: g.resolution,
        params: g.params,
        credits: g.creditsUsed,
        createdAt: g.createdAt,
      };
    });

    return [...fromActive, ...fromHistory];
  }, [activeGenerations, history.items]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  const handleDelete = (id: string) => {
    dismiss(id);
    deleteImage.mutate(id);
  };

  return (
    <ToolPage dock={<MoviePromptForm onSubmit={handleSubmit} />}>
      <ToolResults
        items={items}
        getKey={(item) => item.id}
        history={history}
        shape="square"
        aspectClassName="aspect-square"
        plural="images"
        empty={{
          icon: FilmSlate,
          title: "No movie materials yet",
          description:
            "Pick a mode below, like a character face or a shot board, and describe it.",
        }}
        renderItem={(item) => (
          <MediaResultCard
            result={item}
            noun="image"
            onOpen={() => setSelectedId(item.id)}
            onDelete={handleDelete}
            onDismiss={dismiss}
          />
        )}
      />

      <MediaResultDialog
        result={selected}
        noun="image"
        title={modeLabel(selected?.mode) ?? "Movie material"}
        createdAt={selected?.createdAt}
        details={
          selected
            ? detailRows([
                {
                  label: "Aspect ratio",
                  value:
                    selected.ratio === "auto" ? "Auto" : selected.ratio,
                },
                {
                  label: "Resolution",
                  value: selected.resolution?.toUpperCase(),
                },
                ...paramDetails(selected.mode, selected.params),
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
