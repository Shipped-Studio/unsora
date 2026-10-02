"use client";

import Link from "next/link";
import { Robot } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { libraryRelativeDate } from "@/components/files/library-card";
import {
  isLibraryItemReady,
  libraryItemTitle,
  libraryKindLabel,
  libraryStatusLabel,
  useLibraryPage,
  type LibraryItem,
} from "@/hooks/use-library";
import { cn } from "@/lib/utils";

const LIMIT = 8;

function statusDotClass(status: string) {
  const label = libraryStatusLabel(status);
  if (label === "Completed") return "bg-success";
  if (label === "Failed" || label === "Cancelled") return "bg-destructive";
  return "bg-warning";
}

/** Library link that opens this item's details. */
function itemHref(item: LibraryItem) {
  const params = new URLSearchParams({ source: "api", item: item.id });
  if (item.mediaType !== "document") params.set("tab", item.mediaType);
  return `/files?${params.toString()}`;
}

function RowContent({ item }: { item: LibraryItem }) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">
          {libraryItemTitle(item)}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {libraryKindLabel(item.kind)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", statusDotClass(item.status))}
        />
        {libraryStatusLabel(item.status)}
      </span>
      <span className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground sm:block">
        {libraryRelativeDate(item.createdAt)}
      </span>
    </>
  );
}

/** Latest files made with an API key, including queued and failed jobs. */
export function AgentActivity() {
  const query = useLibraryPage({ source: "api", status: "all", limit: LIMIT });

  if (query.isPending) {
    return (
      <div className="divide-y divide-card rounded-xl bg-muted" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Couldn't load agent activity"
        description={query.error.message}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const items = query.data.items;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Robot}
        className="py-10"
        title="No agent activity yet"
        description="When an agent creates something with your API key, it shows up here with its status. The Claude and ChatGPT connectors sign in without a key, so their files are listed in your Library as web app files."
      />
    );
  }

  return (
    <ul className="divide-y divide-card overflow-hidden rounded-xl bg-muted">
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`}>
          {isLibraryItemReady(item) ? (
            <Link
              href={itemHref(item)}
              className="flex items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
            >
              <RowContent item={item} />
            </Link>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3">
              <RowContent item={item} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
