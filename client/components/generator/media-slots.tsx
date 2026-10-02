"use client";

import { Fragment } from "react";
import Image from "next/image";
import { ArrowRight, X, SpinnerGap } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { UploadField, Attachment } from "./attachments";

interface MediaSlotsProps {
  fields: UploadField[];
  attachments: Attachment[];
  /** Draw an arrow between single-file slots (start → end frame flows). */
  showArrows?: boolean;
  onPick: (field: UploadField) => void;
  onRemove: (id: string) => void;
}

/**
 * Visual upload panel for the "+" button: single-file fields render as
 * framed slots (e.g. Start → End), multi-file fields as a References row.
 */
export function MediaSlots({
  fields,
  attachments,
  showArrows = false,
  onPick,
  onRemove,
}: MediaSlotsProps) {
  const slotFields = fields.filter((f) => f.max === 1);
  const refFields = fields.filter((f) => f.max > 1);

  return (
    <div className={cn(slotFields.length > 2 ? "w-auto max-w-96" : "w-72")}>
      {slotFields.length > 0 && (
        <div className="flex flex-wrap items-start justify-center gap-3 px-4 py-5">
          {slotFields.map((field, i) => (
            <Fragment key={field.key}>
              {showArrows && i > 0 && (
                <ArrowRight className="mt-6 size-4 shrink-0 text-muted-foreground/50" />
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

      {refFields.length > 0 && (
        <div
          className={cn(
            "flex items-center justify-between gap-4 px-4 py-3",
            slotFields.length > 0 && "border-t",
          )}
        >
          <span className="text-sm font-medium">References</span>
          <div className="flex items-center gap-1">
            {refFields.map((field) => {
              const count = attachments.filter(
                (a) => a.fieldKey === field.key,
              ).length;
              return (
                <Tooltip key={field.key}>
                  <TooltipTrigger>
                    <button
                      onClick={() => onPick(field)}
                      disabled={count >= field.max}
                      className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Add ${field.label}`}
                    >
                      <field.icon className="size-[18px]" />
                      {count > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                          {count}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {field.label} ({count}/{field.max})
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
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
        <div className="group relative size-16 overflow-hidden rounded-xl border">
          <Image
            src={attachment.objectUrl}
            alt={attachment.fileName}
            fill
            unoptimized
            className="object-cover"
          />
          {attachment.status === "uploading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <SpinnerGap className="size-4 animate-spin text-white" />
            </div>
          )}
          <button
            onClick={() => onRemove(attachment.id)}
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
            aria-label={`Remove ${field.label}`}
          >
            <X className="size-4 text-white" weight="bold" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => onPick(field)}
          className="flex size-16 items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          aria-label={`Add ${field.label}`}
        >
          <field.icon className="size-5" />
        </button>
      )}
      <span className="text-center text-xs font-medium leading-tight">
        {field.label}
        {optional && (
          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
            optional
          </span>
        )}
      </span>
    </div>
  );
}
