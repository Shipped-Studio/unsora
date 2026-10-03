"use client";

import { useState } from "react";
import {
  ArrowsLeftRight,
  DotsThree,
  DownloadSimple,
  ImageSquare,
  Trash,
} from "@phosphor-icons/react";
import {
  FailedState,
  MEDIA_ICON_BUTTON_CLASS,
  TILE_GHOST_BUTTON_CLASS,
  TILE_CLASS,
  TILE_SKELETON_BAR_CLASS,
  TILE_SKELETON_CLASS,
  UnavailableState,
  useImageFade,
} from "@/components/generator/result-tile";
import { ScheduleLink } from "@/components/generator/tool-layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  isImageUpscaleActive,
  type ImageUpscale,
} from "@/hooks/use-image-upscales-query";
import { cn } from "@/lib/utils";
import { getCdnUrl } from "@/lib/video-utils";

interface UpscaleCardProps {
  job: ImageUpscale;
  /** The uploaded file name, when this visit still remembers it. */
  name?: string;
  onOpen: () => void;
  onDelete: () => void;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * A readable name from a storage URL ("beach-photo.png"), or null when the
 * last path segment is only a generated id.
 */
export function upscaleName(url?: string | null): string | null {
  if (!url) return null;
  let segment: string;
  try {
    segment = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
  } catch {
    return null;
  }
  const cleaned = segment
    // Upload prefixes: timestamps and uuids.
    .replace(/^\d{10,}[-_]/, "")
    .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[-_]?/i, "");
  const base = cleaned.replace(/\.[a-z0-9]+$/i, "");
  if (!base || /^[0-9a-f_-]{12,}$/i.test(base)) return null;
  return cleaned;
}

export function UpscaleCard({ job, name, onOpen, onDelete }: UpscaleCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const active = isImageUpscaleActive(job);
  const failed = job.status === "FAILED";
  const outputUrl = job.status === "COMPLETED" ? job.outputUrl : null;
  const fade = useImageFade(outputUrl);
  const title =
    name ??
    upscaleName(job.inputUrl) ??
    (size ? `${size.w} × ${size.h} image` : "Upscaled image");

  const status = active
    ? job.status === "QUEUED"
      ? "Queued"
      : "Upscaling"
    : failed
      ? "Failed"
      : [
          name || upscaleName(job.inputUrl)
            ? size
              ? `${size.w} × ${size.h}`
              : null
            : null,
          formatDate(job.createdAt),
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <article className={cn("group relative flex flex-col", TILE_CLASS)}>
      {outputUrl && fade.failed ? (
        <div className="aspect-square bg-card">
          <UnavailableState />
        </div>
      ) : outputUrl ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Compare ${title}`}
          className="relative block aspect-square w-full overflow-hidden bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          <img
            src={getCdnUrl(outputUrl)}
            alt={title}
            loading="lazy"
            onLoad={(event) => {
              fade.onLoad();
              const img = event.currentTarget;
              if (img.naturalWidth > 0) {
                setSize({ w: img.naturalWidth, h: img.naturalHeight });
              }
            }}
            onError={fade.onError}
            className={cn("size-full object-cover", fade.className)}
          />
        </button>
      ) : failed ? (
        <div className="aspect-square bg-card">
          <FailedState error={job.error} kind="file" title="Upscaling failed" />
        </div>
      ) : (
        <div className="relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden bg-card px-4 text-center">
          {active && job.inputUrl ? (
            <img
              src={getCdnUrl(job.inputUrl)}
              alt=""
              className="absolute inset-0 size-full object-cover opacity-30"
            />
          ) : null}
          {active ? (
            <>
              <Spinner className="relative text-muted-foreground" />
              <span className="relative text-xs text-muted-foreground">
                {status}
              </span>
            </>
          ) : (
            <ImageSquare className="size-6 text-muted-foreground" />
          )}
        </div>
      )}

      {outputUrl ? (
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={MEDIA_ICON_BUTTON_CLASS}
                  aria-label={`More actions for ${title}`}
                />
              }
            >
              <DotsThree weight="bold" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={onOpen}>
                <ArrowsLeftRight />
                Compare
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={title}>
            {title}
          </p>
          <p className="truncate text-xs text-muted-foreground tabular-nums">
            {status}
          </p>
        </div>

        {outputUrl ? (
          <div className="mt-auto flex items-center gap-1">
            <ScheduleLink url={outputUrl} mediaType="image" size="xs" variant="outline" />
            <a
              href={getCdnUrl(outputUrl, { download: true })}
              download
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-xs" }),
                TILE_GHOST_BUTTON_CLASS,
              )}
              aria-label={`Download ${title}`}
            >
              <DownloadSimple />
            </a>
          </div>
        ) : failed ? (
          <div className="mt-auto flex">
            <Button variant="outline" size="xs" onClick={() => setConfirmOpen(true)}>
              <Trash />
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this image?</AlertDialogTitle>
            <AlertDialogDescription>
              The upscaled image will be removed from your results. This
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                onDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

export function UpscaleCardSkeleton() {
  return (
    <div className={TILE_SKELETON_CLASS}>
      <Skeleton className={cn("aspect-square rounded-none", TILE_SKELETON_BAR_CLASS)} />
      <div className="space-y-2 p-3">
        <Skeleton className={cn("h-4 w-2/3", TILE_SKELETON_BAR_CLASS)} />
        <Skeleton className={cn("h-3 w-1/3", TILE_SKELETON_BAR_CLASS)} />
        <Skeleton className={cn("h-7 w-24", TILE_SKELETON_BAR_CLASS)} />
      </div>
    </div>
  );
}
