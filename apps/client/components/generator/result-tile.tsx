"use client";

import { useState } from "react";
import { ImageSquare, Play, Trash, WarningCircle } from "@phosphor-icons/react";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { friendlyGenerationError } from "./generation-error";

/**
 * Shared look for result tiles and cards across the Create tools, so every
 * tool's results read as one family.
 */

/** Tile or card surface: soft grey fill, no border or ring. */
export const TILE_CLASS = "overflow-hidden rounded-xl bg-muted";

/**
 * Loading stand-in for a tile. Same soft grey surface; put white (bg-card)
 * skeleton bars inside so they show.
 */
export const TILE_SKELETON_CLASS = "overflow-hidden rounded-xl bg-muted";

/** Skeleton bar colour on a grey tile. Pass to <Skeleton className>. */
export const TILE_SKELETON_BAR_CLASS = "bg-card";

/**
 * Ghost icon buttons on a grey tile or row. The default ghost hover
 * (bg-secondary) barely shows on bg-muted, so step up to bg-accent.
 */
export const TILE_GHOST_BUTTON_CLASS = "hover:bg-accent aria-expanded:bg-accent";

/**
 * Round icon button on top of media (tile menus, remove buttons). Use with
 * `<Button variant="ghost" size="icon-xs">`.
 */
export const MEDIA_ICON_BUTTON_CLASS =
  "rounded-full bg-scrim/50 text-media-foreground backdrop-blur-sm hover:bg-scrim/70 hover:text-media-foreground aria-expanded:bg-scrim/70 aria-expanded:text-media-foreground";

/** Play marker on video tiles. Same size and corner everywhere, always visible. */
export function PlayBadge({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute bottom-2 left-2 flex size-7 items-center justify-center rounded-full bg-scrim/50 text-media-foreground backdrop-blur-sm",
        className,
      )}
    >
      <Play className="size-3.5" weight="fill" />
    </span>
  );
}

/**
 * Failed result: icon, a short heading and a plain reason. The heading follows
 * `kind` so every tool says the same thing: "Generation failed" for prompt
 * tools, "Processing failed" for file tools (upscalers, subtitle remover,
 * clipping). The provider's raw message stays in the tooltip for support.
 */
export function FailedState({
  error,
  kind = "prompt",
  title = kind === "file" ? "Processing failed" : "Generation failed",
  className,
  children,
}: {
  error?: string | null;
  kind?: "prompt" | "file";
  title?: string;
  className?: string;
  /** Actions under the message, e.g. Delete or Dismiss. */
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex size-full flex-col items-center justify-center gap-1.5 px-4 text-center",
        className,
      )}
      title={error ?? undefined}
    >
      <WarningCircle className="size-5 text-destructive" />
      <p className="text-sm font-medium">{title}</p>
      <p className="line-clamp-3 text-xs text-muted-foreground">
        {friendlyGenerationError(error, kind)}
      </p>
      {children}
    </div>
  );
}

/**
 * Missing or broken file: icon, "File unavailable" and a plain line. Shown
 * when a result has no file or its image fails to load.
 */
export function UnavailableState({
  className,
  children,
}: {
  className?: string;
  /** Actions under the message, e.g. Delete or Dismiss. */
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex size-full flex-col items-center justify-center gap-1.5 px-4 text-center",
        className,
      )}
    >
      <ImageSquare className="size-5 text-muted-foreground" />
      <p className="text-sm font-medium">File unavailable</p>
      <p className="line-clamp-3 text-xs text-muted-foreground">
        The file for this result is missing.
      </p>
      {children}
    </div>
  );
}

/**
 * The Delete action on a failed or unavailable result. Same label, icon and
 * size on every tool; pair it with <DeleteResultDialog> so it always asks.
 */
export function TileDeleteButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button variant="outline" size="xs" className={className} onClick={onClick}>
      <Trash />
      Delete
    </Button>
  );
}

/** Confirm dialog for deleting a result. Every tool uses this one. */
export function DeleteResultDialog({
  open,
  onOpenChange,
  noun,
  description = "It will be removed from this page and from your Library.",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "video", "image", "song": used in the heading. */
  noun: string;
  /** What gets removed. "This can't be undone." is added after it. */
  description?: React.ReactNode;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this {noun}?</AlertDialogTitle>
          <AlertDialogDescription>
            {description} This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Fades an image in once it has decoded, so tiles show their placeholder
 * instead of half-painted strips. Pass `onLoad`, `onError` and `className`
 * to <img> or next/image (both fire onLoad for cached images too). `failed`
 * turns true when the image can't load, so the tile can show
 * <UnavailableState> instead of a blank box. Pass the image `src` so the
 * state resets when the file changes.
 */
export function useImageFade(src?: string | null) {
  const [state, setState] = useState<{
    src: string | null | undefined;
    status: "loaded" | "error";
  } | null>(null);
  const status = state && state.src === src ? state.status : "loading";
  return {
    onLoad: () => setState({ src, status: "loaded" }),
    onError: () => setState({ src, status: "error" }),
    failed: status === "error",
    // No fade: originals are full size, so hiding them until fully loaded
    // leaves tiles blank for seconds. They paint in progressively instead.
    className: "",
  };
}
