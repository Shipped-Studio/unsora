"use client";

import { useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { PostImage } from "@/hooks/use-post-form";

interface SlideshowPreviewProps {
  images: PostImage[];
  /** Move the image with `id` to position `toIndex`. Omit for read-only. */
  onReorder?: (id: string, toIndex: number) => void;
}

/**
 * Interactive slideshow preview: browse slides with arrows, swipe, keyboard
 * or by clicking a thumbnail, and drag thumbnails to reorder the post.
 * Without an `onReorder` handler it renders read-only (browse only).
 */
export function SlideshowPreview({ images, onReorder }: SlideshowPreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const count = images.length;
  const clampedIndex = Math.min(activeIndex, Math.max(0, count - 1));

  // Clamp the active slide when images are removed.
  useEffect(() => {
    if (activeIndex !== clampedIndex) setActiveIndex(clampedIndex);
  }, [activeIndex, clampedIndex]);

  // Keep the active thumbnail visible in the strip.
  useEffect(() => {
    thumbRefs.current[clampedIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [clampedIndex]);

  if (count === 0) return null;

  const active = images[clampedIndex];

  const goTo = (index: number) =>
    setActiveIndex(Math.max(0, Math.min(count - 1, index)));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(clampedIndex - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(clampedIndex + 1);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    goTo(clampedIndex + (delta < 0 ? 1 : -1));
  };

  const handleThumbDrop = (targetIndex: number) => {
    if (dragId !== null && onReorder) {
      onReorder(dragId, targetIndex);
      setActiveIndex(targetIndex);
    }
    setDragId(null);
    setDropIndex(null);
  };

  return (
    <div className="space-y-3">
      {/* Main slide */}
      <div
        tabIndex={0}
        role="region"
        aria-label={`Slide ${clampedIndex + 1} of ${count}`}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="group relative aspect-2/3 select-none overflow-hidden rounded-lg bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <img
          key={active.id}
          src={active.previewUrl}
          alt={`Slide ${clampedIndex + 1}`}
          draggable={false}
          className="h-full w-full object-cover"
        />

        {count > 1 && (
          <>
            <div className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white tabular-nums">
              {clampedIndex + 1} / {count}
            </div>

            <button
              type="button"
              onClick={() => goTo(clampedIndex - 1)}
              disabled={clampedIndex === 0}
              aria-label="Previous slide"
              className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 focus-visible:opacity-100 disabled:opacity-0 group-hover:opacity-100 group-hover:disabled:opacity-25"
            >
              <CaretLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => goTo(clampedIndex + 1)}
              disabled={clampedIndex === count - 1}
              aria-label="Next slide"
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 focus-visible:opacity-100 disabled:opacity-0 group-hover:opacity-100 group-hover:disabled:opacity-25"
            >
              <CaretRight className="h-4 w-4" />
            </button>

            {/* Dot indicators */}
            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1">
              {images.map((img, i) => (
                <span
                  key={img.id}
                  className={cn(
                    "h-1.5 rounded-full bg-white/50 transition-all",
                    i === clampedIndex ? "w-4 bg-white" : "w-1.5",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip — click to view, drag to reorder */}
      {count > 1 && (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <button
                key={img.id}
                ref={(el) => {
                  thumbRefs.current[i] = el;
                }}
                type="button"
                draggable={!!onReorder}
                onClick={() => goTo(i)}
                onDragStart={(e) => {
                  if (!onReorder) return;
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", img.id);
                  setDragId(img.id);
                  setActiveIndex(i);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setDropIndex(null);
                }}
                onDragOver={(e) => {
                  if (!dragId || dragId === img.id) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropIndex(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleThumbDrop(i);
                }}
                aria-label={`View slide ${i + 1}`}
                className={cn(
                  "relative h-12 w-12 shrink-0 overflow-hidden rounded border transition-all",
                  onReorder && "cursor-grab active:cursor-grabbing",
                  i === clampedIndex
                    ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                    : "opacity-70 hover:opacity-100",
                  dragId === img.id && "opacity-40",
                  dropIndex === i &&
                    dragId !== img.id &&
                    "ring-2 ring-primary scale-95",
                )}
              >
                <img
                  src={img.previewUrl}
                  alt={`Slide ${i + 1}`}
                  draggable={false}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Click a thumbnail to view it
            {onReorder && " · drag to reorder"}
          </p>
        </>
      )}
    </div>
  );
}
