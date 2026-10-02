"use client";

import Image from "next/image";
import { X, WarningCircle, MusicNote } from "@phosphor-icons/react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { Attachment } from "./attachments";

interface AttachmentStripProps {
  attachments: Attachment[];
  /** Field key to label, shown under each tile. */
  fieldLabel?: (fieldKey: string) => string;
  onRemove: (id: string) => void;
}

/** Row of attached files, shown above the composer card. */
export function AttachmentStrip({
  attachments,
  fieldLabel,
  onRemove,
}: AttachmentStripProps) {
  if (attachments.length === 0) return null;

  return (
    <ul
      aria-label="Attached files"
      className="flex items-end gap-2 overflow-x-auto pb-1 scrollbar-none"
    >
      {attachments.map((att) => (
        <li key={att.id} className="flex shrink-0 flex-col gap-1">
          <div
            className={cn(
              "group relative overflow-hidden rounded-xl bg-muted",
              att.kind === "audio"
                ? "flex h-16 max-w-40 items-center gap-2 px-3"
                : "size-16",
            )}
          >
            {att.kind === "image" && (
              <Image
                src={att.objectUrl}
                alt={att.fileName}
                fill
                sizes="64px"
                unoptimized
                className={cn(
                  "object-cover",
                  att.status === "uploading" && "opacity-50",
                )}
              />
            )}
            {att.kind === "video" && (
              <video
                src={att.objectUrl}
                muted
                playsInline
                preload="metadata"
                className={cn(
                  "absolute inset-0 size-full object-cover",
                  att.status === "uploading" && "opacity-50",
                )}
              />
            )}
            {att.kind === "audio" && (
              <>
                <MusicNote className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs">{att.fileName}</span>
              </>
            )}

            {att.status === "uploading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-background/60 text-foreground">
                <Spinner />
                <span className="text-xs tabular-nums">{att.progress}%</span>
              </div>
            )}

            {att.status === "error" && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-background/70"
                title="Upload failed"
              >
                <WarningCircle className="size-5 text-destructive" weight="fill" />
                <span className="sr-only">Upload failed</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => onRemove(att.id)}
              aria-label={`Remove ${att.fileName}`}
              className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full border bg-background text-foreground transition-opacity focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
            >
              <X className="size-3" weight="bold" />
            </button>
          </div>
          {fieldLabel && (
            <span className="max-w-16 truncate text-xs text-muted-foreground">
              {fieldLabel(att.fieldKey)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
