"use client";

import { X } from "@phosphor-icons/react";
import Image from "next/image";
import type { ThumbnailTemplate } from "@/fake";

interface TemplateStripProps {
  templates: ThumbnailTemplate[];
  onRemove: (id: string) => void;
}

export function TemplateStrip({ templates, onRemove }: TemplateStripProps) {
  if (templates.length === 0) return null;

  const isExternal = (src: string) =>
    src.startsWith("http") && !src.includes("unsplash.com");

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
      {templates.map((t) => (
        <div
          key={t.id}
          className="group relative shrink-0 w-28 aspect-video overflow-hidden rounded-lg border shadow-sm"
        >
          <Image
            src={t.src}
            alt={t.title}
            fill
            className="object-cover"
            unoptimized={isExternal(t.src)}
          />
          <button
            onClick={() => onRemove(t.id)}
            className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
          >
            <X className="size-3" weight="bold" />
          </button>
        </div>
      ))}
    </div>
  );
}
