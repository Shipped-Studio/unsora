"use client";

import { useCallback, useMemo, useState } from "react";
import { ImageSquare } from "@phosphor-icons/react";
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
  ImagePromptForm,
  type ImageGenerationSubmitParams,
} from "@/components/image-generator/prompt-form";
import {
  formatResolution,
  imageModelLabel,
} from "@/components/image-generator/model-configs";
import { useImageGeneration } from "@/hooks/use-image-generation";
import {
  useDeleteFromHistory,
  useGenerationHistory,
  useRefreshHistory,
  startedRecently,
} from "@/hooks/use-generation-history";

const TOOL = "image";
const PATH = "/api/image-generations";

interface ImageRecord {
  id: string;
  status: string;
  prompt: string;
  model: string;
  ratio?: string | null;
  resolution?: string | null;
  outputAsset?: { url: string } | null;
  thumbnailAsset?: { url: string } | null;
  error?: string | null;
  creditsUsed?: number | null;
  createdAt: string;
}

interface ImageListResponse {
  generations?: ImageRecord[];
  pagination?: { hasNextPage?: boolean };
}

interface ImageItem extends MediaResult {
  model: string;
  ratio?: string | null;
  resolution?: string | null;
  credits?: number | null;
  createdAt: string;
}

export default function ImageGeneratorPage() {
  const history = useGenerationHistory<ImageRecord>({
    tool: TOOL,
    path: `${PATH}/all`,
    parse: (body) => {
      const data = body as ImageListResponse;
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
  const { activeGenerations, submitGeneration, dismissGeneration } =
    useImageGeneration({ onComplete: () => void refreshHistory() });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async ({ count, ...params }: ImageGenerationSubmitParams) => {
      for (let i = 0; i < count; i++) {
        await submitGeneration(params);
      }
    },
    [submitGeneration],
  );

  const items = useMemo<ImageItem[]>(() => {
    const historyIds = new Set(history.items.map((g) => g.id));
    const activeById = new Map(activeGenerations.map((g) => [g.id, g]));

    const fromActive = activeGenerations
      .filter((g) => !historyIds.has(g.id))
      .map<ImageItem>((g) => ({
        id: g.id,
        status: g.status,
        prompt: g.prompt,
        mediaType: "image",
        url: g.outputAsset?.url ?? null,
        thumbnailUrl: g.thumbnailAsset?.url ?? null,
        error: g.error ?? null,
        local: g.id.startsWith("temp-"),
        model: g.model,
        ratio: g.ratio,
        createdAt: g.createdAt,
      }));

    const fromHistory = history.items.map<ImageItem>((g) => {
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
        model: g.model,
        ratio: g.ratio,
        resolution: g.resolution,
        credits: g.creditsUsed,
        createdAt: g.createdAt,
      };
    });

    return [...fromActive, ...fromHistory];
  }, [activeGenerations, history.items]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  const handleDelete = (id: string) => {
    dismissGeneration(id);
    deleteImage.mutate(id);
  };

  return (
    <ToolPage dock={<ImagePromptForm onSubmit={handleSubmit} />}>
      <ToolResults
        items={items}
        getKey={(item) => item.id}
        history={history}
        shape="square"
        aspectClassName="aspect-square"
        plural="images"
        empty={{
          icon: ImageSquare,
          title: "No images yet",
          description:
            "Describe an image below. Finished images show up here and in Files.",
        }}
        renderItem={(item) => (
          <MediaResultCard
            result={item}
            noun="image"
            onOpen={() => setSelectedId(item.id)}
            onDelete={handleDelete}
            onDismiss={dismissGeneration}
          />
        )}
      />

      <MediaResultDialog
        result={selected}
        noun="image"
        title="Image"
        createdAt={selected?.createdAt}
        details={
          selected
            ? detailRows([
                { label: "Model", value: imageModelLabel(selected.model) },
                { label: "Aspect ratio", value: selected.ratio },
                {
                  label: "Resolution",
                  value: formatResolution(selected.resolution),
                },
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
