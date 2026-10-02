"use client";

import { toast } from "sonner";
import { useAuthFetch } from "./use-auth-fetch";
import { usePagedList, usePollIds } from "./use-paged-list";

/** Video tools that run as server jobs on an uploaded file. */
export type VideoJobKind = "upscale" | "subtitle-removal";

export interface VideoJob {
  id: string;
  originalName: string;
  originalUrl: string | null;
  processedUrl: string | null;
  status: string;
  error: string | null;
  /** Upscale model, when the tool has one. */
  model: string | null;
  createdAt: string;
}

interface RawVideoJob {
  id: string;
  originalName?: string;
  originalAsset?: { url: string } | null;
  processedAsset?: { url: string } | null;
  status?: string;
  error?: string | null;
  upscaleModel?: string | null;
  createdAt?: string;
}

const POLL_INTERVAL_MS = 5_000;

const CONFIG: Record<
  VideoJobKind,
  {
    list: (page: number) => string;
    listKey: "jobs" | "videos";
    refresh: (id: string) => string;
    refreshKey: "job" | "video";
    remove: (id: string) => string;
    done: (name: string) => string;
    failed: (name: string) => string;
  }
> = {
  upscale: {
    list: (page) => `/api/video-upscaler/all?page=${page}&limit=20`,
    listKey: "jobs",
    refresh: (id) => `/api/video-upscaler/refresh/${id}`,
    refreshKey: "job",
    remove: (id) => `/api/video-upscaler/${id}`,
    done: (name) => `Upscaled ${name}`,
    failed: (name) => `Couldn't upscale ${name}`,
  },
  "subtitle-removal": {
    list: (page) =>
      `/api/videos/all?page=${page}&limit=20&operation=WATERMARK_REMOVAL`,
    listKey: "videos",
    refresh: (id) => `/api/videos/refresh/${id}`,
    refreshKey: "video",
    remove: (id) => `/api/videos/${id}`,
    done: (name) => `Removed subtitles from ${name}`,
    failed: (name) => `Couldn't remove subtitles from ${name}`,
  },
};

export const videoJobQueryKeys = {
  all: ["video-jobs"] as const,
  list: (kind: VideoJobKind) => [...videoJobQueryKeys.all, kind] as const,
};

export function isVideoJobActive(job: Pick<VideoJob, "status">) {
  return job.status === "queued" || job.status === "processing";
}

function normalize(raw: RawVideoJob): VideoJob {
  return {
    id: raw.id,
    originalName: raw.originalName ?? "Video",
    originalUrl: raw.originalAsset?.url ?? null,
    processedUrl: raw.processedAsset?.url ?? null,
    status: raw.status ?? "queued",
    error: raw.error ?? null,
    model: raw.upscaleModel ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

/** Only the fields a refresh response actually carries. */
function refreshPatch(raw: RawVideoJob): Partial<VideoJob> {
  const patch: Partial<VideoJob> = {};
  if (raw.status) patch.status = raw.status;
  if (raw.error !== undefined) patch.error = raw.error ?? null;
  if (raw.processedAsset?.url) patch.processedUrl = raw.processedAsset.url;
  if (raw.originalAsset?.url) patch.originalUrl = raw.originalAsset.url;
  if (raw.upscaleModel) patch.model = raw.upscaleModel;
  return patch;
}

/**
 * History and live status for the video upscaler and subtitle remover.
 * Active jobs are refreshed every few seconds until they finish.
 */
export function useVideoJobs(kind: VideoJobKind) {
  const { authFetch } = useAuthFetch();
  const config = CONFIG[kind];

  const list = usePagedList<VideoJob, Record<string, unknown>>({
    queryKey: videoJobQueryKeys.list(kind),
    path: config.list,
    select: (body) => {
      const raw = (body[config.listKey] as RawVideoJob[] | undefined) ?? [];
      const pagination = body.pagination as
        | { hasNextPage?: boolean }
        | undefined;
      return {
        items: raw.map(normalize),
        hasNextPage: pagination?.hasNextPage,
      };
    },
    loadError: "Couldn't load your videos. Try again.",
    remove: {
      path: config.remove,
      success: "Video deleted",
      error: "Couldn't delete the video. Try again.",
    },
  });

  const { items, patchItem } = list;

  usePollIds(
    items.filter(isVideoJobActive).map((job) => job.id),
    async (id) => {
      const res = await authFetch(config.refresh(id));
      if (!res.ok) return;
      const body = await res.json();
      const raw = body?.[config.refreshKey] as RawVideoJob | undefined;
      if (!body?.success || !raw) return;

      patchItem(id, refreshPatch(raw));
      const name = raw.originalName ?? "your video";
      if (raw.status === "completed") {
        toast.success(config.done(name));
      } else if (raw.status === "failed") {
        toast.error(
          raw.error ? `${config.failed(name)}. ${raw.error}` : config.failed(name),
        );
      }
    },
    POLL_INTERVAL_MS,
  );

  return list;
}
