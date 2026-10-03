"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import {
  CalendarPlus,
  Copy,
  DotsThree,
  DownloadSimple,
  Trash,
} from "@phosphor-icons/react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { VideoThumbnail } from "@/components/ui/video-thumbnail";
import { scheduleHref } from "@/lib/scheduler/formats";
import { getCdnUrl } from "@/lib/video-utils";
import { cn } from "@/lib/utils";
import {
  FailedState,
  MEDIA_ICON_BUTTON_CLASS,
  PlayBadge,
  TILE_CLASS,
  UnavailableState,
  useImageFade,
} from "./result-tile";

const cdnLoader = ({ src }: { src: string }) => src;

/** One generated file as every Create tool shows it. */
export interface MediaResult {
  id: string;
  /** "submitting" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" */
  status: string;
  prompt: string;
  mediaType: "image" | "video";
  url?: string | null;
  thumbnailUrl?: string | null;
  error?: string | null;
  /** Failed before the server saved it, so it can only be dismissed. */
  local?: boolean;
}

const PENDING_LABELS: Record<string, string> = {
  submitting: "Starting",
  QUEUED: "Queued",
  PROCESSING: "Generating",
};

export function isPending(status: string) {
  return status !== "COMPLETED" && status !== "FAILED";
}

export function pendingLabel(status: string) {
  return PENDING_LABELS[status] ?? "Generating";
}

export async function copyText(text: string, what = "Prompt") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error(`Couldn't copy the ${what.toLowerCase()}. Select it and copy it manually.`);
  }
}

/** Confirm dialog for deleting a generated file. */
export function DeleteResultDialog({
  open,
  onOpenChange,
  noun,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noun: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this {noun}?</AlertDialogTitle>
          <AlertDialogDescription>
            It will be removed from this page and from your Library. This can&apos;t be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface MediaResultCardProps {
  result: MediaResult;
  /** Word used in labels and confirmations: "video", "image", "thumbnail". */
  noun: string;
  /** Tailwind aspect class for the card, e.g. "aspect-square". */
  aspectClassName?: string;
  onOpen?: (result: MediaResult) => void;
  onDelete?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

/**
 * Grid card for a generated file: in progress, failed (with the reason and a
 * way to clear it) or complete (opens details, with a menu for the rest).
 */
export function MediaResultCard({
  result,
  noun,
  aspectClassName = "aspect-square",
  onOpen,
  onDelete,
  onDismiss,
}: MediaResultCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pending = isPending(result.status);
  const failed = result.status === "FAILED";
  const complete = result.status === "COMPLETED";
  const mediaUrl = result.url ?? null;
  const previewUrl =
    result.mediaType === "image" ? (mediaUrl ?? result.thumbnailUrl) : mediaUrl;
  const title = result.prompt.trim() || `Untitled ${noun}`;
  const canDelete = !result.local && !!onDelete;
  const fade = useImageFade(previewUrl);
  // An image that fails to load reads as "File unavailable", not a blank tile.
  const showMedia =
    complete && !!previewUrl && !(result.mediaType === "image" && fade.failed);

  const tileAction = canDelete ? (
    <Button
      variant="outline"
      size="xs"
      className="mt-1"
      onClick={() => setConfirmDelete(true)}
    >
      <Trash />
      Delete
    </Button>
  ) : onDismiss ? (
    <Button
      variant="outline"
      size="xs"
      className="mt-1"
      onClick={() => onDismiss(result.id)}
    >
      Dismiss
    </Button>
  ) : null;

  return (
    <div className={cn("group relative", TILE_CLASS, aspectClassName)}>
      {showMedia && previewUrl ? (
        <button
          type="button"
          onClick={() => onOpen?.(result)}
          aria-label={`Open ${noun}: ${title}`}
          className="absolute inset-0 size-full cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          {result.mediaType === "video" ? (
            <>
              <VideoThumbnail
                videoUrl={getCdnUrl(previewUrl)}
                thumbnailUrl={result.thumbnailUrl}
                alt=""
              />
              <PlayBadge />
            </>
          ) : (
            <Image
              loader={cdnLoader}
              src={getCdnUrl(previewUrl)}
              alt=""
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              onLoad={fade.onLoad}
              onError={fade.onError}
              className={cn("object-cover", fade.className)}
            />
          )}
        </button>
      ) : pending ? (
        <div
          role="status"
          className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center"
        >
          <Spinner aria-hidden className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {pendingLabel(result.status)}
          </span>
          {result.prompt.trim() && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {result.prompt}
            </p>
          )}
        </div>
      ) : failed ? (
        <FailedState error={result.error}>{tileAction}</FailedState>
      ) : (
        <UnavailableState>{tileAction}</UnavailableState>
      )}

      {showMedia && previewUrl && (
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={MEDIA_ICON_BUTTON_CLASS}
                  aria-label={`More actions for ${noun}`}
                />
              }
            >
              <DotsThree weight="bold" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                render={
                  <Link
                    href={scheduleHref({
                      url: previewUrl,
                      mediaType: result.mediaType,
                    })}
                  />
                }
              >
                <CalendarPlus />
                Schedule
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <a href={getCdnUrl(previewUrl, { download: true })} download />
                }
              >
                <DownloadSimple />
                Download
              </DropdownMenuItem>
              {result.prompt.trim() && (
                <DropdownMenuItem onClick={() => void copyText(result.prompt)}>
                  <Copy />
                  Copy prompt
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {canDelete && (
        <DeleteResultDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          noun={noun}
          onConfirm={() => onDelete?.(result.id)}
        />
      )}
    </div>
  );
}
