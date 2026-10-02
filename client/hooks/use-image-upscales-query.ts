"use client";

import { toast } from "sonner";
import { useAuthFetch } from "./use-auth-fetch";
import { usePagedList, usePollIds } from "./use-paged-list";

export interface ImageUpscale {
  id: string;
  status: string;
  inputUrl: string | null;
  outputUrl: string | null;
  error: string | null;
  createdAt: string;
}

interface RawImageUpscale {
  id: string;
  status?: string;
  inputAsset?: { url: string } | null;
  outputAsset?: { url: string } | null;
  error?: string | null;
  createdAt?: string;
}

const POLL_INTERVAL_MS = 4_000;

export const imageUpscaleQueryKeys = {
  all: ["image-upscales"] as const,
  list: () => [...imageUpscaleQueryKeys.all, "list"] as const,
};

export function isImageUpscaleActive(job: Pick<ImageUpscale, "status">) {
  return job.status === "QUEUED" || job.status === "PROCESSING";
}

function normalize(raw: RawImageUpscale): ImageUpscale {
  return {
    id: raw.id,
    status: raw.status ?? "QUEUED",
    inputUrl: raw.inputAsset?.url ?? null,
    outputUrl: raw.outputAsset?.url ?? null,
    error: raw.error ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

/** Upscale history with live status for queued and running jobs. */
export function useImageUpscales() {
  const { authFetch } = useAuthFetch();

  const list = usePagedList<
    ImageUpscale,
    { jobs?: RawImageUpscale[]; pagination?: { hasNextPage?: boolean } }
  >({
    queryKey: imageUpscaleQueryKeys.list(),
    path: (page) => `/api/image-upscaler/all?page=${page}&limit=20`,
    select: (body) => ({
      items: (body.jobs ?? []).map(normalize),
      hasNextPage: body.pagination?.hasNextPage,
    }),
    loadError: "Couldn't load your upscaled images. Try again.",
    remove: {
      path: (id) => `/api/image-upscaler/${id}`,
      success: "Image deleted",
      error: "Couldn't delete the image. Try again.",
    },
  });

  const { items, patchItem } = list;

  usePollIds(
    items.filter(isImageUpscaleActive).map((job) => job.id),
    async (id) => {
      const res = await authFetch(`/api/image-upscaler/refresh/${id}`);
      if (!res.ok) return;
      const body = await res.json();
      const raw = body?.job as RawImageUpscale | undefined;
      if (!raw?.status) return;

      patchItem(id, {
        status: raw.status,
        error: raw.error ?? null,
        ...(raw.outputAsset?.url ? { outputUrl: raw.outputAsset.url } : {}),
      });
      if (raw.status === "COMPLETED") {
        toast.success("Image upscaled");
      } else if (raw.status === "FAILED") {
        toast.error(
          raw.error
            ? `Couldn't upscale the image. ${raw.error}`
            : "Couldn't upscale the image. Try again.",
        );
      }
    },
    POLL_INTERVAL_MS,
  );

  return list;
}
