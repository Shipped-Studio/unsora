"use client";

import { useCallback, useMemo } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthFetch } from "./use-auth-fetch";

/**
 * Paged history for the Create tools (video, image, thumbnails...). Each tool
 * has its own list endpoint and response shape, so callers pass `parse` to
 * turn a response into items plus whether another page exists.
 */

export interface HistoryPage<T> {
  items: T[];
  hasNextPage: boolean;
}

export const generationHistoryQueryKeys = {
  all: ["generation-history"] as const,
  tool: (tool: string) => [...generationHistoryQueryKeys.all, tool] as const,
};

interface ErrorBody {
  success?: boolean;
  error?: string;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function errorOf(body: unknown): string | undefined {
  const err = (body as ErrorBody | null)?.error;
  return typeof err === "string" && err.trim() ? err : undefined;
}

const PENDING_REFETCH_MS = 15_000;
const STALE_JOB_MS = 3 * 60 * 60 * 1000;

/** Started in the last few hours; older unfinished rows are treated as stuck. */
export function startedRecently(createdAt: string) {
  const time = new Date(createdAt).getTime();
  return Number.isFinite(time) && Date.now() - time < STALE_JOB_MS;
}

export function useGenerationHistory<T extends { id: string }>({
  tool,
  path,
  pageSize = 20,
  parse,
  isInProgress,
}: {
  /** Cache key segment, e.g. "video". */
  tool: string;
  /** List endpoint; receives `page` and `limit` query params. */
  path: string;
  pageSize?: number;
  parse: (body: unknown, page: number) => HistoryPage<T>;
  /**
   * Rows still generating. While any are loaded the list refetches, so jobs
   * started before a reload (or from the API) still resolve on screen.
   */
  isInProgress?: (item: T) => boolean;
}) {
  const { authFetch } = useAuthFetch();

  const query = useInfiniteQuery({
    queryKey: generationHistoryQueryKeys.tool(tool),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        page: String(pageParam),
        limit: String(pageSize),
      });
      const res = await authFetch(`${path}?${params}`);
      const body = await readJson(res);
      if (!res.ok || (body as ErrorBody | null)?.success === false) {
        throw new Error(errorOf(body) ?? `Request failed (${res.status})`);
      }
      return parse(body, pageParam);
    },
    getNextPageParam: (last, pages) =>
      last.hasNextPage ? pages.length + 1 : undefined,
    staleTime: 30_000,
    refetchInterval: (query) =>
      isInProgress &&
      query.state.data?.pages.some((page) => page.items.some(isInProgress))
        ? PENDING_REFETCH_MS
        : false,
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const item of page.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        out.push(item);
      }
    }
    return out;
  }, [query.data]);

  return { ...query, items };
}

/** Refetch a tool's history, e.g. when a generation finishes. */
export function useRefreshHistory(tool: string) {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: generationHistoryQueryKeys.tool(tool),
      }),
    [queryClient, tool],
  );
}

/** DELETE `${path}/${id}`, then drop the item from the cached history. */
export function useDeleteFromHistory({
  tool,
  path,
  noun,
}: {
  tool: string;
  path: string;
  /** "video", "image": used in toasts. */
  noun: string;
}) {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`${path}/${id}`, { method: "DELETE" });
      const body = await readJson(res);
      if (!res.ok || (body as ErrorBody | null)?.success === false) {
        throw new Error(errorOf(body) ?? "Try again.");
      }
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<InfiniteData<HistoryPage<{ id: string }>>>(
        generationHistoryQueryKeys.tool(tool),
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => item.id !== id),
            })),
          },
      );
      toast.success(`${noun.charAt(0).toUpperCase()}${noun.slice(1)} deleted`);
    },
    onError: (error) => {
      toast.error(`Couldn't delete the ${noun}. ${error.message}`);
    },
  });
}
