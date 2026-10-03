"use client";

import Image from "next/image";
import { X } from "@phosphor-icons/react";
import { MEDIA_ICON_BUTTON_CLASS } from "@/components/generator/result-tile";
import { Button } from "@/components/ui/button";
import type { ThumbnailTemplate } from "@/lib/thumbmaker-types";
import { cn } from "@/lib/utils";

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
      <div className="relative aspect-video w-28 overflow-hidden rounded-xl bg-muted">
        <Image
          src={template.src}
          alt={template.title}
          fill
          sizes="112px"
          unoptimized
          className="object-cover"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          aria-label="Remove template"
          className={cn("absolute top-1 right-1", MEDIA_ICON_BUTTON_CLASS)}
        >
          <X weight="bold" />
        </Button>
      </div>
      <span className="text-xs text-muted-foreground">Template</span>
    </div>
  );
}
