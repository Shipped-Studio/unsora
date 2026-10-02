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
  ImageSquare,
  Play,
  Trash,
  WarningCircle,
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
            It will be removed from this page and from Files. This can&apos;t be
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

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl bg-muted",
        aspectClassName,
      )}
    >
      {complete && previewUrl ? (
        <button
          type="button"
          onClick={() => onOpen?.(result)}
          aria-label={`Open ${noun}: ${title}`}
          className="absolute inset-0 size-full cursor-pointer bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          {result.mediaType === "video" ? (
            <>
              <VideoThumbnail
                videoUrl={getCdnUrl(previewUrl)}
                thumbnailUrl={result.thumbnailUrl}
                alt=""
              />
              <span className="absolute bottom-2 left-2 flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground">
                <Play className="size-3.5" weight="fill" />
              </span>
            </>
          ) : (
            <Image
              loader={cdnLoader}
              src={getCdnUrl(previewUrl)}
              alt=""
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover"
            />
          )}
        </button>
      ) : pending ? (
        <div
          role="status"
          className="flex size-full flex-col items-center justify-center gap-2 bg-muted/40 px-4 text-center"
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
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1.5 px-4 text-center">
          {failed ? (
            <WarningCircle className="size-5 text-destructive" />
          ) : (
            <ImageSquare className="size-5 text-muted-foreground" />
          )}
          <p className="text-sm font-medium">
            {failed ? "Generation failed" : "File unavailable"}
          </p>
          <p className="line-clamp-3 text-xs text-muted-foreground">
            {failed
              ? result.error || "The provider didn't return a result."
              : "The file for this result is missing."}
          </p>
          {canDelete ? (
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
          ) : null}
        </div>
      )}

      {complete && previewUrl && (
        <div className="absolute top-2 right-2 transition-opacity has-[[data-popup-open]]:opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
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
