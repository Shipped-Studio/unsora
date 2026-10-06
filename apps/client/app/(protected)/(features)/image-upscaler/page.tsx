"use client";

import { useState } from "react";
import { FrameCorners } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  ToolEmpty,
  ToolGrid,
  ToolPage,
  ToolPane,
  ToolSidebar,
} from "@/components/generator/tool-layout";
import {
  ImageUpscalerForm,
  type ImageUpscaleInput,
} from "@/components/image-upscaler/upload-form";
import {
  UpscaleCard,
  UpscaleCardSkeleton,
  upscaleName,
} from "@/components/image-upscaler/upscale-card";
import { UpscaleDetailDialog } from "@/components/image-upscaler/upscale-detail-dialog";
import { ErrorState } from "@/components/shared/states";
import { Spinner } from "@/components/ui/spinner";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import {
  useImageUpscales,
  type ImageUpscale,
} from "@/hooks/use-image-upscales-query";

export default function ImageUpscalerPage() {
  const { authFetch } = useAuthFetch();
  const upscales = useImageUpscales();
  const { hasNextPage, isFetchingNextPage, loadMoreSentinel } = upscales;
  const [selected, setSelected] = useState<ImageUpscale | null>(null);
  // The server doesn't store file names, so remember the ones from this visit.
  const [names, setNames] = useState<Record<string, string>>({});

  const nameFor = (job: ImageUpscale) =>
    names[job.id] ?? upscaleName(job.inputUrl) ?? "Upscaled image";

  async function handleSubmit(items: ImageUpscaleInput[]) {
    let started = 0;
    for (const item of items) {
      try {
        const res = await authFetch("/api/image-upscaler/create", {
          method: "POST",
          body: JSON.stringify({
            imageUrl: item.imageUrl,
            resolution: item.resolution,
          }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.success) {
          toast.error(
            `Couldn't upscale ${item.originalName}. ${body?.error || "Try again."}`,
          );
          continue;
        }
        const id = body.job?.id as string | undefined;
        if (id) setNames((prev) => ({ ...prev, [id]: item.originalName }));
        started += 1;
      } catch {
        toast.error(
          `Couldn't upscale ${item.originalName}. Check your connection and try again.`,
        );
      }
    }
    if (started > 0) await upscales.invalidate();
    return started === items.length;
  }

  return (
    <ToolPage className="p-0 sm:p-0 lg:flex-row lg:items-start">
      <ToolSidebar>
        <ImageUpscalerForm onSubmit={handleSubmit} />
      </ToolSidebar>

      <ToolPane label="Results">
        {upscales.isLoading ? (
          <ToolGrid shape="square">
            {Array.from({ length: 8 }).map((_, i) => (
              <UpscaleCardSkeleton key={i} />
            ))}
          </ToolGrid>
        ) : upscales.isError ? (
          <ErrorState
            title="Couldn't load your images"
            description={upscales.error?.message}
            onRetry={() => void upscales.refetch()}
          />
        ) : upscales.items.length === 0 ? (
          <ToolEmpty
            showcase
            icon={FrameCorners}
            title="No upscaled images yet"
            description="Upload images and pick an output resolution."
          />
        ) : (
          <>
            <ToolGrid shape="square">
              {upscales.items.map((job) => (
                <UpscaleCard
                  key={job.id}
                  job={job}
                  name={names[job.id]}
                  onOpen={() => setSelected(job)}
                  onDelete={() => void upscales.deleteItem(job.id)}
                />
              ))}
            </ToolGrid>
            {hasNextPage ? (
              <div
                ref={loadMoreSentinel}
                className="flex justify-center py-6"
              >
                {isFetchingNextPage ? (
                  <Spinner className="text-muted-foreground" />
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </ToolPane>

      <UpscaleDetailDialog
        job={selected}
        name={selected ? nameFor(selected) : ""}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </ToolPage>
  );
}
