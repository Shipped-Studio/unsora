"use client";

import { useMemo, useState } from "react";
import { UserFocus } from "@phosphor-icons/react";
import { ToolPage } from "@/components/generator/tool-layout";
import { ToolResults } from "@/components/generator/tool-results";
import type { ParamConfig } from "@/components/generator/param-control";
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
  InfluencerPromptForm,
  cameraAngleParam,
  styleParam,
} from "@/components/influencer-studio/prompt-form";
import { useInfluencerStudio } from "@/hooks/use-influencer-studio";
import {
  useDeleteFromHistory,
  useGenerationHistory,
  useRefreshHistory,
  startedRecently,
} from "@/hooks/use-generation-history";

const TOOL = "influencer";
const PATH = "/api/influencer-studio";

interface InfluencerRecord {
  id: string;
  status: string;
  prompt: string;
  ratio?: string | null;
  params?: Record<string, unknown> | null;
  outputAsset?: { url: string } | null;
  thumbnailAsset?: { url: string } | null;
  error?: string | null;
  creditsUsed?: number | null;
  createdAt: string;
}

interface InfluencerListResponse {
  generations?: InfluencerRecord[];
  pagination?: { hasNextPage?: boolean };
}

interface InfluencerItem extends MediaResult {
  ratio?: string | null;
  params?: Record<string, unknown> | null;
  credits?: number | null;
  createdAt: string;
}

function optionLabel(param: ParamConfig, value: unknown) {
  if (typeof value !== "string" || !value) return null;
  return param.options.find((o) => o.value === value)?.label ?? value;
}

export default function AiInfluencerStudioPage() {
  const history = useGenerationHistory<InfluencerRecord>({
    tool: TOOL,
    path: `${PATH}/all`,
    parse: (body) => {
      const data = body as InfluencerListResponse;
      return {
        items: data.generations ?? [],
        hasNextPage: !!data.pagination?.hasNextPage,
      };
    },
    isInProgress: (g) => isPending(g.status) && startedRecently(g.createdAt),
  });
  const refreshHistory = useRefreshHistory(TOOL);
  const deletePhoto = useDeleteFromHistory({
    tool: TOOL,
    path: PATH,
    noun: "photo",
  });
  const { activeGenerations, submit, dismiss } = useInfluencerStudio({
    onComplete: () => void refreshHistory(),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = useMemo<InfluencerItem[]>(() => {
    const historyIds = new Set(history.items.map((g) => g.id));
    const activeById = new Map(activeGenerations.map((g) => [g.id, g]));

    const fromActive = activeGenerations
      .filter((g) => !historyIds.has(g.id))
      .map<InfluencerItem>((g) => ({
        id: g.id,
        status: g.status,
        prompt: g.prompt,
        mediaType: "image",
        url: g.outputAsset?.url ?? null,
        thumbnailUrl: g.thumbnailAsset?.url ?? null,
        error: g.error ?? null,
        local: g.id.startsWith("temp-"),
        createdAt: g.createdAt,
      }));

    const fromHistory = history.items.map<InfluencerItem>((g) => {
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
        ratio: g.ratio,
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
    deletePhoto.mutate(id);
  };

  return (
    <ToolPage dock={<InfluencerPromptForm onSubmit={submit} />}>
      <ToolResults
        items={items}
        getKey={(item) => item.id}
        history={history}
        shape="portrait"
        aspectClassName="aspect-[3/4]"
        plural="photos"
        empty={{
          icon: UserFocus,
          title: "No photos yet",
          description:
            "Describe a person below to get photos of the same character.",
        }}
        renderItem={(item) => (
          <MediaResultCard
            result={item}
            noun="photo"
            aspectClassName="aspect-[3/4]"
            onOpen={() => setSelectedId(item.id)}
            onDelete={handleDelete}
            onDismiss={dismiss}
          />
        )}
      />

      <MediaResultDialog
        result={selected}
        noun="photo"
        title="Photo"
        createdAt={selected?.createdAt}
        details={
          selected
            ? detailRows([
                { label: "Model", value: "GPT Image 2" },
                { label: "Aspect ratio", value: selected.ratio },
                {
                  label: "Style",
                  value: optionLabel(styleParam, selected.params?.style_mode),
                },
                {
                  label: "Camera angle",
                  value: optionLabel(
                    cameraAngleParam,
                    selected.params?.camera_angle,
                  ),
                },
                {
                  label: "Age",
                  value:
                    selected.params?.age != null
                      ? String(selected.params.age)
                      : null,
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
