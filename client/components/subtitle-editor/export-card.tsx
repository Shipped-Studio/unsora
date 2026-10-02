"use client";

import { useState } from "react";
import Link from "next/link";
import { useInView } from "react-intersection-observer";
import {
  ArrowSquareOut,
  DotsThreeVertical,
  DownloadSimple,
  Play,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ScheduleLink } from "@/components/generator/tool-layout";
import {
  asSentence,
  downloadUrl,
  exportFileName,
  formatClock,
  formatDate,
} from "@/components/subtitle-editor/format";
import { getExportStatus } from "@/hooks/subtitle/use-subtitle-queries";
import type { ExportListItem } from "@/hooks/subtitle/use-subtitle-api";

export const EXPORT_GRID_CLASS =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

function exportMeta(item: ExportListItem): string {
  return [
    formatDate(item.createdAt),
    formatClock(item.duration),
    item.width && item.height ? `${item.width}×${item.height}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** First frame of the video, loaded once the card scrolls near view. */
function VideoFrame({ url }: { url: string }) {
  const { ref, inView } = useInView({ rootMargin: "300px 0px", triggerOnce: true });
  return (
    <span ref={ref} className="block size-full">
      {inView ? (
        <video
          src={`${url}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          className="size-full object-contain"
        />
      ) : null}
    </span>
  );
}

export function ExportCard({
  item,
  onDelete,
  showProjectLink = false,
}: {
  item: ExportListItem;
  onDelete: (item: ExportListItem) => void;
  /** Adds an "Open project" menu item, for lists that span projects. */
  showProjectLink?: boolean;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileName = exportFileName(item);
  const status = getExportStatus(item);
  const url = status === "completed" ? item.outputAsset?.url : undefined;
  const meta = exportMeta(item);

  return (
    <article className="flex flex-col overflow-hidden rounded-xl bg-muted">
      <div className="relative aspect-video bg-muted">
        {url ? (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            aria-label={`Play ${fileName}`}
            className="group absolute inset-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
          >
            <VideoFrame url={url} />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-background/90 text-foreground shadow-xs">
                <Play weight="fill" className="size-4" />
              </span>
            </span>
          </button>
        ) : status === "failed" || status === "completed" ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 bg-muted px-4 text-center">
            <WarningCircle className="size-6 text-destructive" />
            <p className="text-xs text-muted-foreground">
              {status === "failed" ? "Render failed" : "Video unavailable"}
            </p>
          </div>
        ) : (
          <div
            role="status"
            className="flex size-full flex-col items-center justify-center gap-2 bg-muted"
          >
            <Spinner aria-hidden className="size-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {status === "processing" ? "Rendering" : "Queued"}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-sm font-medium">{fileName}</p>
            <p className="truncate text-xs tabular-nums text-muted-foreground">
              {meta}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="-mt-1 -mr-2"
                  aria-label={`Actions for ${fileName}`}
                />
              }
            >
              <DotsThreeVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {showProjectLink && item.transcription ? (
                <>
                  <DropdownMenuItem
                    render={
                      <Link href={`/subtitle-editor/${item.transcription.id}`} />
                    }
                  >
                    <ArrowSquareOut />
                    Open project
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(item)}
              >
                <Trash />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {status === "failed" ? (
          <>
            <p className="line-clamp-3 text-xs text-destructive">
              {item.error
                ? asSentence(item.error)
                : "The render failed. Delete it and export again."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-auto self-start"
              onClick={() => onDelete(item)}
            >
              <Trash />
              Delete
            </Button>
          </>
        ) : null}

        {url ? (
          <div className="mt-auto flex flex-wrap gap-2">
            <a
              href={downloadUrl(url, fileName)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <DownloadSimple />
              Download
            </a>
            <ScheduleLink url={url} mediaType="video" />
          </div>
        ) : null}
      </div>

      {url ? (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="truncate pr-8">{fileName}</DialogTitle>
              <DialogDescription className="tabular-nums">{meta}</DialogDescription>
            </DialogHeader>
            <video
              src={url}
              controls
              autoPlay
              playsInline
              className="max-h-[65svh] w-full rounded-lg bg-muted"
            />
            <DialogFooter>
              <ScheduleLink url={url} mediaType="video" size="default" />
              <a
                href={downloadUrl(url, fileName)}
                className={buttonVariants()}
              >
                <DownloadSimple />
                Download
              </a>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </article>
  );
}

export function ExportCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl bg-muted">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="space-y-3 p-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    </div>
  );
}
