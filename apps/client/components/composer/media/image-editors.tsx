"use client";

import { useMemo, useRef, useState } from "react";
import { CaretLeft, CaretRight, FolderOpen, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MediaDrop } from "./media-drop";
import { SortableMedia } from "./sortable-media";
import type { Composer } from "@/hooks/use-composer";
import type { ConnectedAccount } from "@/lib/scheduler/types";
import { formatRule, platformName, type PostFormat } from "@/lib/scheduler/formats";
import { cn } from "@/lib/utils";

/** Largest image count any selected platform accepts for this format. */
function limitSummary(format: PostFormat, selected: ConnectedAccount[]) {
  const limits = selected
    .map((a) => ({ name: platformName(a.provider), max: formatRule(a.provider, format)?.maxImages }))
    .filter((l): l is { name: string; max: number } => typeof l.max === "number");
  if (!limits.length) return { max: 35, strictest: null as null | { name: string; max: number } };
  const strictest = limits.reduce((a, b) => (b.max < a.max ? b : a));
  return { max: strictest.max, strictest };
}

function AddTile({
  onUpload,
  onLibrary,
  className,
}: {
  onUpload: () => void;
  onLibrary: () => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Add images"
            className={cn(
              "flex items-center justify-center rounded-lg border border-dashed border-input text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
              className,
            )}
          />
        }
      >
        <Plus className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={onUpload}>
          <Plus />
          Upload images
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onLibrary}>
          <FolderOpen />
          Choose from Library
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function useImageUpload(composer: Composer) {
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      multiple
      hidden
      onChange={(event) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = "";
        if (files.length) void composer.uploadFiles(files, "image");
      }}
    />
  );
  return { open: () => ref.current?.click(), input };
}

export function PhotoEditor({
  composer,
  selectedAccounts,
  onOpenLibrary,
}: {
  composer: Composer;
  selectedAccounts: ConnectedAccount[];
  onOpenLibrary: () => void;
}) {
  const { state, reorderMedia, removeMedia, uploadFiles } = composer;
  const images = state.media.filter((m) => m.kind === "image");
  const upload = useImageUpload(composer);
  const { max, strictest } = limitSummary("photos", selectedAccounts);

  // Flag images outside the tightest aspect ratio among selected accounts.
  const warnings = useMemo(() => {
    const out: Record<string, string> = {};
    for (const account of selectedAccounts) {
      const aspect = formatRule(account.provider, "photos")?.aspect;
      if (!aspect) continue;
      for (const img of images) {
        if (!img.width || !img.height) continue;
        const ratio = img.width / img.height;
        if (ratio < aspect.min - 0.01 || ratio > aspect.max + 0.01) {
          out[img.key] = `${platformName(account.provider)} needs images ${aspect.label}.`;
        }
      }
    }
    return out;
  }, [images, selectedAccounts]);

  if (images.length === 0) {
    return (
      <MediaDrop
        kind="image"
        multiple
        title="Add images"
        hint="JPG or PNG. One image posts as a photo; two or more post as a carousel."
        onFiles={(files) => void uploadFiles(files, "image")}
        onOpenLibrary={onOpenLibrary}
      />
    );
  }

  return (
    <div className="space-y-2">
      <SortableMedia
        items={images}
        layout="grid"
        onReorder={reorderMedia}
        onRemove={removeMedia}
        warnings={warnings}
        tileClassName="aspect-square"
        trailing={
          images.length < max ? (
            <AddTile
              className="aspect-square"
              onUpload={upload.open}
              onLibrary={onOpenLibrary}
            />
          ) : null
        }
      />
      <p className="text-xs text-muted-foreground">
        {images.length} {images.length === 1 ? "image" : "images"}
        {strictest ? ` · ${strictest.name} takes up to ${strictest.max}` : ""}. Drag to reorder.
      </p>
      {upload.input}
    </div>
  );
}

export function SlideshowEditor({
  composer,
  selectedAccounts,
  onOpenLibrary,
}: {
  composer: Composer;
  selectedAccounts: ConnectedAccount[];
  onOpenLibrary: () => void;
}) {
  const { state, update, reorderMedia, removeMedia, uploadFiles } = composer;
  const slides = state.media.filter((m) => m.kind === "image");
  const upload = useImageUpload(composer);
  const { max, strictest } = limitSummary("slideshow", selectedAccounts);
  const [rawActive, setActive] = useState(0);
  // Clamp instead of syncing state when slides are removed.
  const active = Math.max(0, Math.min(rawActive, slides.length - 1));
  const current = slides[active];

  if (slides.length === 0) {
    return (
      <MediaDrop
        kind="image"
        multiple
        title="Add slides"
        hint="Vertical 9:16 images look best. TikTok takes up to 35."
        onFiles={(files) => void uploadFiles(files, "image")}
        onOpenLibrary={onOpenLibrary}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 rounded-xl bg-muted p-3 sm:grid-cols-[200px_1fr]">
      <div className="space-y-2">
        <div className="relative mx-auto aspect-9/16 w-full max-w-[200px] overflow-hidden rounded-lg bg-media">
          {current ? (
            <img src={current.previewUrl} alt="" className="size-full object-contain" />
          ) : null}
          <div className="absolute inset-x-0 top-2 flex justify-center gap-1 px-2">
            {slides.map((slide, index) => (
              <span
                key={slide.key}
                className={cn(
                  "h-0.5 flex-1 rounded-full",
                  index === active ? "bg-media-foreground" : "bg-media-foreground/35",
                )}
              />
            ))}
          </div>
          <Button
            type="button"
            size="icon-xs"
            variant="secondary"
            aria-label="Previous slide"
            disabled={active === 0}
            onClick={() => setActive((i) => Math.max(0, i - 1))}
            className="absolute top-1/2 left-1.5 -translate-y-1/2"
          >
            <CaretLeft />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="secondary"
            aria-label="Next slide"
            disabled={active >= slides.length - 1}
            onClick={() => setActive((i) => Math.min(slides.length - 1, i + 1))}
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
          >
            <CaretRight />
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground tabular-nums">
          Slide {active + 1} of {slides.length}
        </p>
      </div>

      <div className="min-w-0 space-y-3">
        <SortableMedia
          items={slides}
          layout="strip"
          onReorder={(from, to) => {
            reorderMedia(from, to);
            setActive(to);
          }}
          onRemove={removeMedia}
          selectedIndex={state.coverIndex}
          onSelect={(index) => {
            setActive(index);
            update((prev) => ({ ...prev, coverIndex: index }));
          }}
          tileClassName="aspect-[9/16] w-20 shrink-0"
          trailing={
            slides.length < max ? (
              <AddTile
                className="aspect-[9/16] w-20 shrink-0"
                onUpload={upload.open}
                onLibrary={onOpenLibrary}
              />
            ) : null
          }
        />
        <p className="text-xs text-muted-foreground">
          Drag to reorder. Click a slide to make it the cover (highlighted).
          {strictest ? ` ${strictest.name} takes up to ${strictest.max}.` : ""}
        </p>
      </div>
      {upload.input}
    </div>
  );
}
