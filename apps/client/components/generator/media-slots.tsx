"use client";

import { Fragment } from "react";
import Image from "next/image";
import { ArrowRight, MusicNote, UploadSimple, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { UploadField, Attachment } from "./attachments";
import { MEDIA_ICON_BUTTON_CLASS } from "./result-tile";

interface MediaSlotsProps {
  fields: UploadField[];
  attachments: Attachment[];
  /** Draw an arrow between single-file slots (start to end frame flows). */
  showArrows?: boolean;
  /** Opens the library for a field. */
  onPick: (field: UploadField) => void;
  onRemove: (id: string) => void;
  /** Opens the device file picker. Adds an Upload row when set. */
  onUpload?: () => void;
}

/**
 * Panel behind the composer's "Add media" button: single-file fields render
 * as framed slots (e.g. Start then End), multi-file fields as a list.
 */
export function MediaSlots({
  fields,
  attachments,
  showArrows = false,
  onPick,
  onRemove,
  onUpload,
}: MediaSlotsProps) {
  const slotFields = fields.filter((f) => f.max === 1);
  const listFields = fields.filter((f) => f.max > 1);

  return (
    <div
      className={cn(
        "max-w-[calc(100vw-2rem)]",
        slotFields.length > 2 ? "w-96" : "w-72",
      )}
    >
      <p className="px-4 pt-3 text-xs text-muted-foreground">
        {onUpload
          ? "Pick from your Library or upload new files."
          : "Pick from your Library."}
      </p>

      {slotFields.length > 0 && (
        <div className="flex flex-wrap items-start justify-center gap-3 px-4 py-4">
          {slotFields.map((field, i) => (
            <Fragment key={field.key}>
              {showArrows && i > 0 && (
                <ArrowRight
                  aria-hidden
                  className="mt-6 size-4 shrink-0 text-muted-foreground"
                />
              )}
              <SlotBox
                field={field}
                optional={showArrows && i > 0}
                attachment={attachments.find((a) => a.fieldKey === field.key)}
                onPick={onPick}
                onRemove={onRemove}
              />
            </Fragment>
          ))}
        </div>
      )}

      {listFields.length > 0 && (
        <div
          className={cn(
            "space-y-0.5 p-2",
            slotFields.length > 0 && "border-t",
          )}
        >
          {listFields.map((field) => {
            const count = attachments.filter(
              (a) => a.fieldKey === field.key && a.status !== "error",
            ).length;
            return (
              <button
                key={field.key}
                type="button"
                onClick={() => onPick(field)}
                disabled={count >= field.max}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
              >
                <field.icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-left">{field.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {count}/{field.max}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {onUpload && (
        <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5">
          <span className="text-xs text-muted-foreground">
            You can also drop or paste files.
          </span>
          <Button type="button" variant="outline" size="xs" onClick={onUpload}>
            <UploadSimple />
            Upload
          </Button>
        </div>
      )}
    </div>
  );
}

function SlotBox({
  field,
  optional,
  attachment,
  onPick,
  onRemove,
}: {
  field: UploadField;
  optional: boolean;
  attachment?: Attachment;
  onPick: (field: UploadField) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex w-20 flex-col items-center gap-1.5">
      {attachment ? (
        <div className="relative size-16 overflow-hidden rounded-xl bg-muted">
          {attachment.kind === "image" && (
            <Image
              src={attachment.objectUrl}
              alt={attachment.fileName}
              fill
              sizes="64px"
              unoptimized
              className="object-cover"
            />
          )}
          {attachment.kind === "video" && (
            <video
              src={attachment.objectUrl}
              muted
              playsInline
              preload="metadata"
              className="absolute inset-0 size-full object-cover"
            />
          )}
          {attachment.kind === "audio" && (
            <div className="flex size-full items-center justify-center">
              <MusicNote className="size-5 text-muted-foreground" />
            </div>
          )}
          {attachment.status === "uploading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-scrim/50 text-media-foreground">
              <Spinner />
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onRemove(attachment.id)}
            aria-label={`Remove ${field.label.toLowerCase()}`}
            className={cn("absolute top-1 right-1", MEDIA_ICON_BUTTON_CLASS)}
          >
            <X weight="bold" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onPick(field)}
          aria-label={`Add ${field.label.toLowerCase()}`}
          className="flex size-16 items-center justify-center rounded-xl border border-dashed text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <field.icon className="size-5" />
        </button>
      )}
      <span className="text-center text-xs leading-tight">
        {field.label}
        {optional && (
          <span className="block text-muted-foreground">Optional</span>
        )}
      </span>
    </div>
  );
}
