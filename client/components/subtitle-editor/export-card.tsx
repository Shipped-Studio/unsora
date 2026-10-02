"use client";

import Link from "next/link";
import {
  DownloadSimple,
  FilmSlate,
  Trash,
  ArrowSquareOut,
  WarningCircle,
} from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { getCdnUrl } from "@/lib/video-utils";
import {
  StatusBadge,
  buildDownloadUrl,
  formatDuration,
  type ExportListItem,
} from "./exports-list";

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface ExportCardProps {
  item: ExportListItem;
  /** Request deletion — the parent shows a confirmation dialog. */
  onDelete: (id: string) => void;
}

export function ExportCard({ item, onDelete }: ExportCardProps) {
  const fileName =
    typeof item.settings?.fileName === "string" && item.settings.fileName
      ? (item.settings.fileName as string)
      : "Export";
  const outputUrl = item.outputAsset?.url;
  const isReady = item.status === "completed" && !!outputUrl;

  return (
    <Card size="sm" className="group gap-0 overflow-hidden rounded-xl py-0">
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        {isReady ? (
          <video
            src={getCdnUrl(outputUrl!)}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/50">
            {item.status === "failed" ? (
              <>
                <WarningCircle className="size-8 text-destructive/70" />
                <p className="max-w-[90%] truncate text-xs text-destructive">
                  {item.error || "Export failed"}
                </p>
              </>
            ) : (
              <>
                <Spinner className="size-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground capitalize">
                  {item.status || "queued"}...
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <CardContent className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{fileName}</p>
          <StatusBadge status={item.status} />
        </div>

        <p className="text-xs text-muted-foreground">
          {formatDate(item.createdAt)} · {formatDuration(item.duration)}
          {item.width && item.height ? ` · ${item.width}×${item.height}` : ""}
        </p>

        {item.transcription && (
          <Link
            href={`/subtitle-editor/${item.transcription.id}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <ArrowSquareOut className="size-3" />
            <span className="truncate">
              {item.transcription.filename || "Open project"}
            </span>
          </Link>
        )}

        <div className="flex items-center gap-1.5 pt-1">
          {isReady && (
            <Button
              variant="outline"
              size="xs"
              className="flex-1 gap-1.5 text-xs"
              render={<a href={buildDownloadUrl(outputUrl!, fileName)} />}
            >
              <DownloadSimple className="size-3.5" weight="bold" />
              Download
            </Button>
          )}
          <button
            onClick={() => onDelete(item.id)}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash className="size-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ExportCardSkeleton() {
  return (
    <Card size="sm" className="gap-0 overflow-hidden rounded-xl py-0">
      <Skeleton className="aspect-video w-full rounded-b-none" />
      <CardContent className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-7 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

export function ExportsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
      <FilmSlate className="size-10 text-muted-foreground/40" weight="thin" />
      <p className="text-sm text-muted-foreground">No exports yet</p>
      <p className="max-w-xs text-xs text-muted-foreground/70">
        Export a video from any subtitle project and it will show up here so
        you can download it anytime.
      </p>
    </div>
  );
}
