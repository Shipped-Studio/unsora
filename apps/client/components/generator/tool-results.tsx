"use client";

import type { Icon } from "@phosphor-icons/react";
import { useInView } from "react-intersection-observer";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ToolEmpty, ToolGrid } from "./tool-layout";

/** The parts of an infinite query the results grid needs. */
export interface HistoryState {
  data?: unknown;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: () => unknown;
  refetch: () => unknown;
}

interface ToolResultsProps<T> {
  /** In-flight generations first, then history. */
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  history: HistoryState;
  shape?: "square" | "video" | "portrait";
  /** Aspect class for skeleton tiles, matching the cards. */
  aspectClassName: string;
  /** Plural noun for error copy, e.g. "videos". */
  plural: string;
  empty: { icon: Icon; title: string; description: string };
}

/**
 * Results area for a Create tool: skeletons while the first page loads, an
 * error with retry, an empty state, then the grid with infinite loading.
 */
export function ToolResults<T>({
  items,
  getKey,
  renderItem,
  history,
  shape = "square",
  aspectClassName,
  plural,
  empty,
}: ToolResultsProps<T>) {
  const canLoadMore =
    history.hasNextPage &&
    !history.isFetchingNextPage &&
    !history.isFetchNextPageError;

  const { ref: sentinelRef } = useInView({
    rootMargin: "400px 0px",
    skip: !canLoadMore,
    onChange: (inView) => {
      if (inView && canLoadMore) void history.fetchNextPage();
    },
  });

  const skeletons = (count: number) =>
    Array.from({ length: count }, (_, i) => (
      <Skeleton key={`skeleton-${i}`} className={`${aspectClassName} rounded-xl`} />
    ));

  if (items.length === 0) {
    if (history.isPending) {
      return (
        <ToolGrid shape={shape}>
          {skeletons(8)}
        </ToolGrid>
      );
    }
    if (history.isError) {
      return (
        <ErrorState
          title={`Couldn't load your ${plural}`}
          description={history.error?.message || undefined}
          onRetry={() => void history.refetch()}
        />
      );
    }
    return (
      <ToolEmpty
        showcase
        icon={empty.icon}
        title={empty.title}
        description={empty.description}
      />
    );
  }

  const initialLoadFailed = history.isError && !history.data;

  return (
    <div className="space-y-4">
      {initialLoadFailed && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            Couldn&apos;t load your earlier {plural}.
          </span>
          <Button variant="outline" size="sm" onClick={() => void history.refetch()}>
            Try again
          </Button>
        </div>
      )}

      <ToolGrid shape={shape}>
        {items.map((item) => (
          <div key={getKey(item)} className="min-w-0">
            {renderItem(item)}
          </div>
        ))}
        {history.isPending && skeletons(4)}
      </ToolGrid>

      {history.isFetchNextPageError ? (
        <div className="flex items-center justify-center gap-3 py-4 text-sm text-muted-foreground">
          Couldn&apos;t load more {plural}.
          <Button
            variant="outline"
            size="sm"
            onClick={() => void history.fetchNextPage()}
          >
            Try again
          </Button>
        </div>
      ) : history.hasNextPage ? (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {history.isFetchingNextPage && (
            <Spinner className="text-muted-foreground" />
          )}
        </div>
      ) : null}
    </div>
  );
}
