"use client";

import { useMemo, useState } from "react";
import { PersonSimpleRun } from "@phosphor-icons/react";
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
import { motionModelLabel } from "@/components/generator/model-labels";
import { useCatalogGeneration } from "@/hooks/use-catalog-generation";
import { useCatalogLabel } from "@/hooks/use-model-catalog";
import {
  useDeleteFromHistory,
  useGenerationHistory,
  useRefreshHistory,
  startedRecently,
} from "@/hooks/use-generation-history";

const TOOL = "motion-control";
const PATH = "/api/motion-control";

interface MotionRecord {
  id: string;
  status: string;
  prompt: string;
  model: string;
  resolution?: string | null;
  outputAsset?: { url: string } | null;
  thumbnailAsset?: { url: string } | null;
  error?: string | null;
  creditsUsed?: number | null;
  createdAt: string;
}

interface MotionListResponse {
  generations?: MotionRecord[];
  pagination?: { hasNextPage?: boolean };
}

interface MotionItem extends MediaResult {
  model: string;
  resolution?: string | null;
  credits?: number | null;
  createdAt: string;
}

export default function MotionControlPage() {
  const history = useGenerationHistory<MotionRecord>({
    tool: TOOL,
    path: `${PATH}/all`,
    parse: (body) => {
      const data = body as MotionListResponse;
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
    path: PATH,
    noun: "video",
  });
  const {
    activeGenerations,
    submit,
    dismiss: dismissGeneration,
  } = useCatalogGeneration("motion-control", {
    onSettled: () => void refreshHistory(),
  });
  const catalogLabel = useCatalogLabel("motion-control");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = useMemo<MotionItem[]>(() => {
    const historyIds = new Set(history.items.map((g) => g.id));
    const activeById = new Map(activeGenerations.map((g) => [g.id, g]));

    const fromActive = activeGenerations
      .filter((g) => !historyIds.has(g.id))
      .map<MotionItem>((g) => ({
        id: g.id,
        status: g.status,
        prompt: g.prompt,
        mediaType: "video",
        url: g.outputAsset?.url ?? null,
        error: g.error ?? null,
        local: g.id.startsWith("temp-"),
        model: g.model,
        createdAt: g.createdAt,
      }));

    const fromHistory = history.items.map<MotionItem>((g) => {
      const active = activeById.get(g.id);
      return {
        id: g.id,
        status: active?.status ?? g.status,
        prompt: g.prompt,
        mediaType: "video",
        url: active?.outputAsset?.url ?? g.outputAsset?.url ?? null,
        thumbnailUrl: g.thumbnailAsset?.url ?? null,
        error: active?.error ?? g.error ?? null,
        model: g.model,
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
    deleteVideo.mutate(id);
  };

  return (
    <ToolPage
      dock={
        <CatalogPromptForm
          category="motion-control"
          noun="video"
          defaultModel="kling-mc-3.0-pro"
          placeholder="Describe the motion or scene"
          promptLabel="Motion control prompt"
          onSubmit={submit}
        />
      }
    >
      <ToolResults
        items={items}
        getKey={(item) => item.id}
        history={history}
        shape="square"
        aspectClassName="aspect-square"
        plural="videos"
        empty={{
          icon: PersonSimpleRun,
          title: "No motion videos yet",
          description:
            "Add a video with the motion and an image of your character below.",
        }}
        renderItem={(item) => (
          <MediaResultCard
            result={item}
            noun="video"
            onOpen={() => setSelectedId(item.id)}
            onDelete={handleDelete}
            onDismiss={dismissGeneration}
          />
        )}
      />

      <MediaResultDialog
        result={selected}
        noun="video"
        title="Motion control video"
        createdAt={selected?.createdAt}
        details={
          selected
            ? detailRows([
                {
                  label: "Model",
                  value:
                    catalogLabel(selected.model) ??
                    motionModelLabel(selected.model),
                },
                { label: "Resolution", value: selected.resolution },
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
