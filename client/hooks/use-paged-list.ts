"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
} from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { toast } from "sonner";
import { useAuthFetch } from "./use-auth-fetch";

export interface ListPage<T> {
  items: T[];
  page: number;
  hasNextPage: boolean;
}

/**
 * Throws with the server's `error` string (or `fallback`) when a write
 * failed, either by status or by `success: false` in the body.
 */
export async function assertOk(res: Response, fallback: string) {
  const body = await res.json().catch(() => null);
  if (res.ok && body?.success !== false) return;
  throw new Error(
    typeof body?.error === "string" && body.error ? body.error : fallback,
  );
}

interface PagedListOptions<T, B> {
  queryKey: QueryKey;
  /** API path for one page, e.g. (page) => `/api/x/all?page=${page}&limit=20`. */
  path: (page: number) => string;
  /** Pulls the items and the next-page flag out of a response body. */
  select: (body: B) => { items: T[] | undefined; hasNextPage: boolean | undefined };
  /** Shown when the server doesn't say why loading failed. */
  loadError: string;
  remove?: {
    path: (id: string) => string;
    /** Toast after a successful delete, e.g. "Song deleted". */
    success: string;
    /** Toast when the server doesn't say why deleting failed. */
    error: string;
  };
}

/**
 * Paginated history for a tool page: infinite query, cache helpers for
 * polling updates, and an optional delete mutation that keeps the cache in
 * sync.
 */
export function usePagedList<T extends { id: string }, B = unknown>({
  queryKey,
  path,
  select,
  loadError,
  remove,
}: PagedListOptions<T, B>) {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  // Callers usually build the key inline; keep one reference per key so the
  // helpers below stay stable across renders.
  const keyHash = JSON.stringify(queryKey);
  const stableKey = useMemo(() => JSON.parse(keyHash) as QueryKey, [keyHash]);

  const query = useInfiniteQuery({
    queryKey: stableKey,
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<ListPage<T>> => {
      const res = await authFetch(path(pageParam));
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        throw new Error(
          typeof body?.error === "string" && body.error ? body.error : loadError,
        );
      }
      const { items, hasNextPage } = select(body as B);
      return {
        items: items ?? [],
        hasNextPage: Boolean(hasNextPage),
        page: pageParam,
      };
    },
    getNextPageParam: (last) => (last.hasNextPage ? last.page + 1 : undefined),
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  const updateItems = useCallback(
    (fn: (items: T[]) => T[]) => {
      queryClient.setQueryData<InfiniteData<ListPage<T>>>(stableKey, (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                items: fn(page.items),
              })),
            }
          : data,
      );
    },
    [queryClient, stableKey],
  );

  const patchItem = useCallback(
    (id: string, patch: Partial<T>) =>
      updateItems((list) =>
        list.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      ),
    [updateItems],
  );

  const removeItem = useCallback(
    (id: string) => updateItems((list) => list.filter((item) => item.id !== id)),
    [updateItems],
  );

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: stableKey }),
    [queryClient, stableKey],
  );

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!remove) return id;
      const res = await authFetch(remove.path(id), { method: "DELETE" });
      await assertOk(res, remove.error);
      return id;
    },
    onSuccess: (id) => {
      removeItem(id);
      if (remove) toast.success(remove.success);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : (remove?.error ?? "Couldn't delete this. Try again."),
      );
    },
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  // Attach to an element after the last result to load the next page.
  const { ref: loadMoreSentinel } = useInView({
    rootMargin: "400px 0px",
    skip: !hasNextPage || isFetchingNextPage,
    onChange: (inView) => {
      if (inView) void fetchNextPage();
    },
  });

  const { mutateAsync } = deleteMutation;
  const deleteItem = useCallback(
    (id: string) =>
      mutateAsync(id).then(
        () => true,
        () => false,
      ),
    [mutateAsync],
  );

  return {
    items,
    isLoading: query.isPending,
    // A failed background refetch keeps showing the data we already have.
    isError: query.isError && query.data === undefined,
    error: query.error,
    refetch: query.refetch,
    hasNextPage,
    isFetchingNextPage,
    loadMoreSentinel,
    patchItem,
    removeItem,
    invalidate,
    deleteItem,
  };
}

/**
 * Calls `poll` for every id on an interval while there are ids to watch.
 * Failed polls are dropped and retried on the next tick.
 */
export function usePollIds(
  ids: string[],
  poll: (id: string) => Promise<void>,
  intervalMs: number,
) {
  const key = ids.join(",");
  const pollRef = useRef(poll);
  useEffect(() => {
    pollRef.current = poll;
  });

  useEffect(() => {
    if (!key) return;
    const list = key.split(",");
    const timer = setInterval(() => {
      list.forEach((id) => {
        pollRef.current(id).catch(() => undefined);
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [key, intervalMs]);
}
