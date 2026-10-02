"use client";

import Image from "next/image";
import { X, SpinnerGap, WarningCircle, MusicNote } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { Attachment } from "./attachments";

interface AttachmentStripProps {
  attachments: Attachment[];
  /** Field key → label, shown as a badge on each tile. */
  fieldLabel?: (fieldKey: string) => string;
  onRemove: (id: string) => void;
}

/** Horizontal preview strip of attachments, shown above the prompt card. */
export function AttachmentStrip({
  attachments,
  fieldLabel,
  onRemove,
}: AttachmentStripProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {attachments.map((att) => (
        <div
          key={att.id}
          className={cn(
            "group relative shrink-0 overflow-hidden rounded-lg border shadow-sm bg-muted",
            att.kind === "audio"
              ? "flex h-20 items-center gap-2 px-3"
              : "w-20 aspect-square",
          )}
        >
          {att.kind === "image" && (
            <Image
              src={att.objectUrl}
              alt={att.fileName}
              fill
              className={cn(
                "object-cover transition-opacity",
                att.status === "uploading" && "opacity-50",
              )}
              unoptimized
            />
          )}
          {att.kind === "video" && (
            <video
              src={att.objectUrl}
              muted
              preload="metadata"
              className={cn(
                "absolute inset-0 size-full object-cover transition-opacity",
                att.status === "uploading" && "opacity-50",
              )}
            />
          )}
          {att.kind === "audio" && (
            <>
              <MusicNote className="size-4 shrink-0 text-muted-foreground" />
              <span className="max-w-24 truncate text-xs">{att.fileName}</span>
            </>
          )}

          {fieldLabel && att.kind !== "audio" && (
            <span className="absolute bottom-0 inset-x-0 bg-black/50 px-1 py-0.5 text-center text-[9px] font-medium leading-none text-white truncate">
              {fieldLabel(att.fieldKey)}
            </span>
          )}

          {att.status === "uploading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <SpinnerGap className="size-5 animate-spin text-white drop-shadow" />
              <span className="text-[10px] font-semibold text-white drop-shadow">
                {att.progress}%
              </span>
            </div>
          )}

          {att.status === "error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-destructive/30">
              <WarningCircle className="size-5 text-destructive" weight="fill" />
            </div>
          )}

          <button
            onClick={() => onRemove(att.id)}
            className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
            aria-label={`Remove ${att.fileName}`}
          >
            <X className="size-3" weight="bold" />
          </button>
        </div>
      ))}
    </div>
  );
}
