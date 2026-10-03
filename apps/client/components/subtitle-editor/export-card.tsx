"use client";

import { useState } from "react";
import Link from "next/link";
import { useInView } from "react-intersection-observer";
import {
  ArrowSquareOut,
  DotsThree,
  DownloadSimple,
  FileVideo,
  Trash,
} from "@phosphor-icons/react";
import {
  FailedState,
  MEDIA_ICON_BUTTON_CLASS,
  TILE_GHOST_BUTTON_CLASS,
  PlayBadge,
  TILE_CLASS,
  TILE_SKELETON_BAR_CLASS,
  TILE_SKELETON_CLASS,
} from "@/components/generator/result-tile";
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
  downloadUrl,
  exportFileName,
  formatClock,
  formatDate,
} from "@/components/subtitle-editor/format";
import { getExportStatus } from "@/hooks/subtitle/use-subtitle-queries";
import type { ExportListItem } from "@/hooks/subtitle/use-subtitle-api";
import { cn } from "@/lib/utils";

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
    <article className={cn("group relative flex flex-col", TILE_CLASS)}>
      <div className="relative aspect-video bg-card">
        {url ? (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            aria-label={`Play ${fileName}`}
            className="absolute inset-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
          >
            <VideoFrame url={url} />
            <PlayBadge />
          </button>
        ) : status === "failed" ? (
          <FailedState
            error={item.error}
            kind="file"
            title="Render failed"
          />
        ) : status === "completed" ? (
          <div className="flex size-full flex-col items-center justify-center gap-1.5 px-4 text-center">
            <FileVideo className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium">Video unavailable</p>
            <p className="text-xs text-muted-foreground">
              The file for this export is missing.
            </p>
          </div>
        ) : (
          <div
            role="status"
            className="flex size-full flex-col items-center justify-center gap-2"
          >
            <Spinner aria-hidden className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {status === "processing" ? "Rendering" : "Queued"}
            </p>
          </div>
        )}
      </div>

      <div className="absolute top-2 right-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className={MEDIA_ICON_BUTTON_CLASS}
                aria-label={`Actions for ${fileName}`}
              />
            }
          >
            <DotsThree weight="bold" />
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

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{fileName}</p>
          <p className="truncate text-xs tabular-nums text-muted-foreground">
            {meta}
          </p>
        </div>

        {status === "failed" ? (
          <div className="mt-auto flex">
            <Button variant="outline" size="xs" onClick={() => onDelete(item)}>
              <Trash />
              Delete
            </Button>
          </div>
        ) : null}

        {url ? (
          <div className="mt-auto flex items-center gap-1">
            <ScheduleLink url={url} mediaType="video" size="xs" variant="outline" />
            <a
              href={downloadUrl(url, fileName)}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-xs" }),
                TILE_GHOST_BUTTON_CLASS,
              )}
              aria-label={`Download ${fileName}`}
            >
              <DownloadSimple />
            </a>
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
              className="max-h-[65svh] w-full rounded-lg bg-media"
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
    <div className={TILE_SKELETON_CLASS}>
      <Skeleton
        className={cn("aspect-video w-full rounded-none", TILE_SKELETON_BAR_CLASS)}
      />
      <div className="space-y-3 p-3">
        <div className="space-y-2">
          <Skeleton className={cn("h-4 w-2/3", TILE_SKELETON_BAR_CLASS)} />
          <Skeleton className={cn("h-3 w-1/2", TILE_SKELETON_BAR_CLASS)} />
        </div>
        <Skeleton className={cn("h-7 w-24", TILE_SKELETON_BAR_CLASS)} />
      </div>
    </div>
  );
}
