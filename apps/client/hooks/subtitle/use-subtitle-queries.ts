"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  useSubtitleApi,
  type ExportListItem,
  type PaginationMeta,
  type TranscriptionListItem,
} from "@/hooks/subtitle/use-subtitle-api";
import type { VideoExportItem } from "@/remotion/types";

export const SUBTITLE_PAGE_SIZE = 12;

/** Stop polling rows that have sat in a running state for longer than this. */
const STALE_JOB_MS = 60 * 60 * 1000;
const LIST_POLL_MS = 5000;

export const subtitleQueryKeys = {
  all: ["subtitle-editor"] as const,
  projects: () => [...subtitleQueryKeys.all, "projects"] as const,
  projectsPage: (page: number) =>
    [...subtitleQueryKeys.projects(), page] as const,
  exports: () => [...subtitleQueryKeys.all, "exports"] as const,
  exportsPage: (page: number) =>
    [...subtitleQueryKeys.exports(), page] as const,
};

interface ListPage<T> {
  items: T[];
  pagination: PaginationMeta | null;
}

export type ExportStatus = "queued" | "processing" | "completed" | "failed";

export function getExportStatus(item: VideoExportItem): ExportStatus {
  const status = item.status ?? "queued";
  return status === "processing" ||
    status === "completed" ||
    status === "failed"
    ? status
    : "queued";
}

function isRecent(createdAt: Date | string) {
  return Date.now() - new Date(createdAt).getTime() < STALE_JOB_MS;
}

/** A recent export that the renderer hasn't finished yet. */
export function isExportRunning(item: VideoExportItem): boolean {
  const status = getExportStatus(item);
  return (
    (status === "queued" || status === "processing") && isRecent(item.createdAt)
  );
}

export function isTranscriptionRunning(item: TranscriptionListItem): boolean {
  return (
    (item.status === "pending" ||
      item.status === "processing" ||
      item.status === "queued") &&
    isRecent(item.updatedAt ?? item.createdAt)
  );
}

export function useSubtitleProjects(page: number) {
  const api = useSubtitleApi();

  return useQuery({
    queryKey: subtitleQueryKeys.projectsPage(page),
    queryFn: async (): Promise<ListPage<TranscriptionListItem>> => {
      const result = await api.getUserTranscriptions(page, SUBTITLE_PAGE_SIZE);
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.error ?? "Couldn't load your projects.");
      }
      return { items: result.data, pagination: result.pagination ?? null };
    },
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      query.state.data?.items.some(isTranscriptionRunning)
        ? LIST_POLL_MS
        : false,
  });
}

export function useSubtitleExports(page: number) {
  const api = useSubtitleApi();

  return useQuery({
    queryKey: subtitleQueryKeys.exportsPage(page),
    queryFn: async (): Promise<ListPage<ExportListItem>> => {
      const result = await api.getUserExports(page, SUBTITLE_PAGE_SIZE);
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.error ?? "Couldn't load your exports.");
      }
      return { items: result.data, pagination: result.pagination ?? null };
    },
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      query.state.data?.items.some(isExportRunning) ? LIST_POLL_MS : false,
  });
}

export function useDeleteSubtitleProject() {
  const api = useSubtitleApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.deleteTranscription(id);
      if (!result.success) {
        throw new Error(result.error || "Try again.");
      }
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueriesData<ListPage<TranscriptionListItem>>(
        { queryKey: subtitleQueryKeys.projects() },
        (old) =>
          old && { ...old, items: old.items.filter((item) => item.id !== id) },
      );
      // Deleting a project also deletes its exports.
      return queryClient.invalidateQueries({ queryKey: subtitleQueryKeys.all });
    },
  });
}

export function useDeleteSubtitleExport() {
  const api = useSubtitleApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.deleteExport(id);
      if (!result.success) {
        throw new Error(result.error || "Try again.");
      }
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueriesData<ListPage<ExportListItem>>(
        { queryKey: subtitleQueryKeys.exports() },
        (old) =>
          old && { ...old, items: old.items.filter((item) => item.id !== id) },
      );
      return queryClient.invalidateQueries({
        queryKey: subtitleQueryKeys.exports(),
      });
    },
  });
}
