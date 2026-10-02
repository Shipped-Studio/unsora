"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GridFour, ImagesSquare } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
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
} from "@/components/generator/media-result-dialog";
import { ThumbPromptForm } from "@/components/thumbnail-generator/prompt-form";
import { useThumbnailGeneration } from "@/hooks/use-thumbnail-generation";
import {
  useDeleteFromHistory,
  useGenerationHistory,
  useRefreshHistory,
  startedRecently,
} from "@/hooks/use-generation-history";
import type {
  ThumbmakerThumbnail,
  ThumbmakerThumbnailsListResponse,
} from "@/lib/thumbmaker-types";

const TOOL = "thumbnail";
const PATH = "/api/thumbnails";

interface ThumbnailItem extends MediaResult {
  description?: string | null;
  link?: string | null;
  createdAt: string;
}

export default function ThumbnailGeneratorPage() {
  const history = useGenerationHistory<ThumbmakerThumbnail>({
    tool: TOOL,
    path: PATH,
    parse: (body, page) => {
      const data = body as Partial<ThumbmakerThumbnailsListResponse>;
      return {
        items: data.data ?? [],
        hasNextPage: page < (data.pagination?.totalPages ?? 1),
      };
    },
    isInProgress: (g) => isPending(g.status) && startedRecently(g.createdAt),
  });
  const refreshHistory = useRefreshHistory(TOOL);
  const deleteThumbnail = useDeleteFromHistory({
    tool: TOOL,
    path: PATH,
    noun: "thumbnail",
  });
  const { activeGenerations, trackGenerations, dismissGeneration } =
    useThumbnailGeneration({ onComplete: () => void refreshHistory() });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = useMemo<ThumbnailItem[]>(() => {
    const historyIds = new Set(history.items.map((t) => t.id));
    const activeById = new Map(activeGenerations.map((g) => [g.id, g]));

    const fromActive = activeGenerations
      .filter((g) => !historyIds.has(g.id))
      .map<ThumbnailItem>((g) => ({
        id: g.id,
        status: g.status,
        prompt: g.prompt,
        mediaType: "image",
        url: g.outputAsset?.url ?? null,
        thumbnailUrl: g.thumbnailAsset?.url ?? null,
        error: g.error ?? null,
        createdAt: g.createdAt,
      }));

    const fromHistory = history.items.map<ThumbnailItem>((t) => {
      const active = activeById.get(t.id);
      return {
        id: t.id,
        status: active?.status ?? t.status,
        prompt: t.title?.trim() ?? "",
        mediaType: "image",
        url: active?.outputAsset?.url ?? (t.image || null),
        error: active?.error ?? t.error,
        description: t.description,
        link: t.link,
        createdAt: t.createdAt,
      };
    });

    return [...fromActive, ...fromHistory];
  }, [activeGenerations, history.items]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  const handleDelete = (id: string) => {
    dismissGeneration(id);
    deleteThumbnail.mutate(id);
  };

  return (
    <ToolPage
      actions={
        <Link
          href="/thumbnail-generator/templates"
          className={buttonVariants({ variant: "outline" })}
        >
          <GridFour />
          Templates
        </Link>
      }
      dock={<ThumbPromptForm onGenerationsStarted={trackGenerations} />}
    >
      <ToolResults
        items={items}
        getKey={(item) => item.id}
        history={history}
        shape="video"
        aspectClassName="aspect-video"
        plural="thumbnails"
        empty={{
          icon: ImagesSquare,
          title: "No thumbnails yet",
          description:
            "Describe a thumbnail below, or start from a template or a YouTube video.",
        }}
        renderItem={(item) => (
          <MediaResultCard
            result={item}
            noun="thumbnail"
            aspectClassName="aspect-video"
            onOpen={() => setSelectedId(item.id)}
            onDelete={handleDelete}
            onDismiss={dismissGeneration}
          />
        )}
      />

      <MediaResultDialog
        result={selected}
        noun="thumbnail"
        title="Thumbnail"
        createdAt={selected?.createdAt}
        details={
          selected
            ? detailRows([
                { label: "Aspect ratio", value: "16:9" },
                { label: "Description", value: selected.description?.trim() },
              ])
            : []
        }
        footnote={
          selected?.link?.trim() ? (
            <a
              href={selected.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline underline-offset-4 hover:text-muted-foreground"
            >
              Open source link
            </a>
          ) : null
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
