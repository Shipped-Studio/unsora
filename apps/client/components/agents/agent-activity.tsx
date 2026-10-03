"use client";

import { Robot } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { libraryRelativeDate } from "@/components/files/library-card";
import { AgentMediaList, AgentMediaRow } from "@/components/home/agent-media-row";
import {
  isLibraryItemReady,
  libraryKindLabel,
  libraryStatusLabel,
  useLibraryPage,
  type LibraryItem,
} from "@/hooks/use-library";

const LIMIT = 8;

/** Library link that opens this item's details. */
function itemHref(item: LibraryItem) {
  const params = new URLSearchParams({ source: "api", item: item.id });
  if (item.mediaType !== "document") params.set("tab", item.mediaType);
  return `/files?${params.toString()}`;
}

function statusTone(status: string) {
  const label = libraryStatusLabel(status);
  if (label === "Failed" || label === "Cancelled") return "text-destructive";
  return "text-warning";
}

function RowMeta({ item }: { item: LibraryItem }) {
  const status = libraryStatusLabel(item.status);
  return (
    <>
      {libraryKindLabel(item.kind)}
      {status !== "Completed" ? (
        <>
          {" · "}
          <span className={statusTone(item.status)}>{status}</span>
        </>
      ) : null}
      {" · "}
      {libraryRelativeDate(item.createdAt)}
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
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="size-10 shrink-0 rounded-lg bg-card" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Couldn't load agent activity"
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
    <AgentMediaList>
      {items.map((item) => (
        <AgentMediaRow
          key={`${item.kind}-${item.id}`}
          item={item}
          href={isLibraryItemReady(item) ? itemHref(item) : undefined}
          meta={<RowMeta item={item} />}
        />
      ))}
    </AgentMediaList>
  );
}
