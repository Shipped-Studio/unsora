"use client";

import Image from "next/image";
import { X } from "@phosphor-icons/react";
import type { ThumbnailTemplate } from "@/lib/thumbmaker-types";

/** The chosen template, shown above the composer. */
export function TemplateStrip({
  template,
  onRemove,
}: {
  template: ThumbnailTemplate;
  onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-1">
      <div className="group relative aspect-video w-28 overflow-hidden rounded-xl bg-muted">
        <Image
          src={template.src}
          alt={template.title}
          fill
          sizes="112px"
          unoptimized
          className="object-cover"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove template"
          className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full border bg-background text-foreground transition-opacity focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
        >
          <X className="size-3" weight="bold" />
        </button>
      </div>
      <span className="text-xs text-muted-foreground">Template</span>
    </div>
  );
}
