"use client";

import { useState } from "react";
import {
  ImageSquare,
  VideoCamera,
  MusicNotes,
  FileText,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/admin/page-header";
import { Pager } from "@/components/admin/data-table";
import { useAdminContent, type ContentQuery } from "@/hooks/admin/use-admin-data";
import { timeAgo } from "@/lib/admin-format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TYPES = [
  { key: "all", label: "All" },
  { key: "IMAGE", label: "Images" },
  { key: "VIDEO", label: "Videos" },
  { key: "AUDIO", label: "Audio" },
  { key: "DOCUMENT", label: "Docs" },
];

export default function AdminContentPage() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState("all");

  const query: ContentQuery = {
    page,
    limit: 48,
    type: type === "all" ? "" : type,
  };
  const { data, isLoading, isFetching } = useAdminContent(query);

  const countFor = (t: string) =>
    data?.typeCounts.find((c) => c.type === t)?.count ?? 0;

  return (
    <div>
      <PageHeader
        title="Content"
        description="What users are actually generating — the media they produce."
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TYPES.map((t) => {
          const active = type === t.key;
          const count = t.key === "all" ? undefined : countFor(t.key);
          return (
            <button
              key={t.key}
              onClick={() => {
                setType(t.key);
                setPage(1);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {count !== undefined && (
                <span className="tabular-nums opacity-70">
                  {count.toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 18 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : data && data.assets.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-card text-sm text-muted-foreground">
          No content found.
        </div>
      ) : (
        <div className={cn(isFetching && "opacity-60 transition-opacity")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {data?.assets.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
                title={a.name}
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  <AssetPreview type={a.type} url={a.url} />
                </div>
                <div className="flex flex-col gap-0.5 p-2">
                  <span className="truncate text-[11px] text-muted-foreground">
                    {a.user?.email ?? "—"}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70">
                    {timeAgo(a.createdAt)}
                  </span>
                </div>
              </a>
            ))}
          </div>
          {data && (
            <Pager
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              total={data.pagination.total}
              onPage={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}

function AssetPreview({ type, url }: { type: string; url: string }) {
  if (type === "IMAGE") {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
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
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <VideoCamera weight="fill" className="size-7 text-white/90" />
        </div>
      </>
    );
  }
  const Icon =
    type === "AUDIO" ? MusicNotes : type === "DOCUMENT" ? FileText : ImageSquare;
  return (
    <div className="flex size-full items-center justify-center">
      <Icon weight="duotone" className="size-8 text-muted-foreground" />
    </div>
  );
}
