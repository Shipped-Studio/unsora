"use client";

import { useState } from "react";
import {
  FileText,
  ImageSquare,
  MusicNotes,
  Play,
} from "@phosphor-icons/react";
import { AdminPage } from "@/components/admin/admin-page";
import { Pager } from "@/components/admin/data-table";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAdminContent, type ContentQuery } from "@/hooks/admin/use-admin-data";
import { timeAgo } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

const TYPES = [
  { key: "all", label: "All" },
  { key: "IMAGE", label: "Images" },
  { key: "VIDEO", label: "Videos" },
  { key: "AUDIO", label: "Audio" },
  { key: "DOCUMENT", label: "Docs" },
];

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6";

export default function AdminContentPage() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState("all");

  const query: ContentQuery = {
    page,
    limit: 48,
    type: type === "all" ? "" : type,
  };
  const { data, isLoading, isFetching, error, refetch } = useAdminContent(query);

  const countFor = (t: string) =>
    data?.typeCounts.find((c) => c.type === t)?.count ?? 0;

  return (
    <AdminPage title="Content" description="The media users generate and upload">
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={0}
        aria-label="Media type"
        value={[type]}
        onValueChange={(next) => {
          if (!next[0]) return;
          setType(String(next[0]));
          setPage(1);
        }}
        className="max-w-full overflow-x-auto no-scrollbar"
      >
        {TYPES.map((t) => (
          <ToggleGroupItem key={t.key} value={t.key} className="gap-1.5">
            {t.label}
            {t.key === "all" ? null : (
              <span className="text-xs text-muted-foreground tabular-nums">
                {countFor(t.key).toLocaleString()}
              </span>
            )}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {error && !data ? (
        <ErrorState
          title="Couldn't load content"
          description={error.message}
          onRetry={() => void refetch()}
        />
      ) : isLoading || !data ? (
        <div className={GRID}>
          {Array.from({ length: 18 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : data.assets.length === 0 ? (
        <EmptyState
          icon={ImageSquare}
          title="No content found"
          description="Nothing of this type has been generated or uploaded yet."
        />
      ) : (
        <div className={cn("space-y-3", isFetching && "opacity-60 transition-opacity")}>
          <div className={GRID}>
            {data.assets.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                title={a.name}
                className="flex flex-col overflow-hidden rounded-xl bg-muted transition-colors hover:border-foreground/20"
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  <AssetPreview type={a.type} url={a.url} />
                </div>
                <div className="flex flex-col gap-0.5 p-2">
                  <span className="truncate text-xs">{a.user?.email ?? "Unknown user"}</span>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(a.createdAt)}
                  </span>
                </div>
              </a>
            ))}
          </div>
          <Pager
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            total={data.pagination.total}
            onPage={setPage}
            disabled={isFetching}
          />
        </div>
      )}
    </AdminPage>
  );
}

function AssetPreview({ type, url }: { type: string; url: string }) {
  if (type === "IMAGE") {
    return (
      <img src={url} alt="" loading="lazy" className="size-full object-cover" />
    );
  }
  if (type === "VIDEO") {
    return (
      <>
        <video
          src={url}
          muted
          playsInline
          preload="metadata"
          className="size-full object-cover"
        />
        <span className="absolute bottom-1.5 left-1.5 flex size-6 items-center justify-center rounded-md bg-background/80 text-foreground">
          <Play weight="fill" className="size-3" />
        </span>
      </>
    );
  }
  const Icon = type === "AUDIO" ? MusicNotes : type === "DOCUMENT" ? FileText : ImageSquare;
  return (
    <div className="flex size-full items-center justify-center">
      <Icon className="size-8 text-muted-foreground" />
    </div>
  );
}
