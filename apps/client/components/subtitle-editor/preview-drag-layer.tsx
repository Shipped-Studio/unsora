"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  WIDGET_DEFAULTS,
  sizeToPixels,
  type CaptionPlacement,
  type Timeline,
} from "@/components/subtitle-editor/caption-style";
import type { TitleOverlayConfig } from "@/components/subtitle-editor/title-overlay";

/** "subtitles", "title", or "widget:<id>" for a speaker tag or call to action. */
type TargetKey = string;
const WIDGET_PREFIX = "widget:";

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Room around the text, in screen pixels, so the box doesn't hug it. */
const BOX_PADDING = 6;
const KEY_STEP = 1;

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
const roundHalf = (n: number) => Math.round(n * 2) / 2;

function sameBox(a: Box | null, b: Box | null) {
  return (
    a === b ||
    (a !== null &&
      b !== null &&
      a.left === b.left &&
      a.top === b.top &&
      a.width === b.width &&
      a.height === b.height)
  );
}

/** Where the subtitles sit between lines, when nothing is drawn. */
function subtitleFallback(
  frameWidth: number,
  frameHeight: number,
  {
    placement,
    hasSubtitles,
    compositionWidth,
  }: {
    placement: CaptionPlacement;
    hasSubtitles: boolean;
    compositionWidth: number;
  },
): Box | null {
  if (!hasSubtitles) return null;
  const width = (placement.width / 100) * frameWidth;
  const height =
    sizeToPixels(placement.size, compositionWidth) *
    1.15 *
    (frameWidth / compositionWidth);
  return {
    left: (placement.x / 100) * frameWidth - width / 2,
    top: (placement.y / 100) * frameHeight - height / 2,
    width,
    height,
  };
}

interface Drag {
  key: TargetKey;
  /** -1 for a left corner, 1 for a right one, 0 when moving. */
  side: -1 | 0 | 1;
  startX: number;
  startY: number;
  placement: CaptionPlacement;
  titleOverlay: TitleOverlayConfig;
  timeline: Timeline;
}

/**
 * Sits over the preview player. Hovering the subtitles or the title shows a
 * box: drag it to move it up or down, drag a corner to change its width.
 * It reads where the text is from the player's DOM, so it fits what's shown.
 */
export function PreviewDragLayer({
  active,
  compositionWidth,
  hasSubtitles,
  placement,
  onPlacementChange,
  titleOverlay,
  onTitleOverlayChange,
  timeline,
  onTimelineChange,
}: {
  /** Measure only while the pointer is over the preview. */
  active: boolean;
  compositionWidth: number;
  hasSubtitles: boolean;
  placement: CaptionPlacement;
  onPlacementChange: (values: CaptionPlacement) => void;
  titleOverlay: TitleOverlayConfig;
  onTitleOverlayChange: (config: TitleOverlayConfig) => void;
  timeline: Timeline;
  onTimelineChange: (timeline: Timeline) => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState<TargetKey | null>(null);
  const [boxes, setBoxes] = useState<Record<TargetKey, Box | null>>({
    subtitles: null,
    title: null,
  });

  // Latest props for the pointer handlers, which outlive a render.
  const latest = useRef({
    placement,
    titleOverlay,
    timeline,
    hasSubtitles,
    compositionWidth,
  });
  useEffect(() => {
    latest.current = {
      placement,
      titleOverlay,
      timeline,
      hasSubtitles,
      compositionWidth,
    };
  });

  const measuring = active || dragging !== null;

  useEffect(() => {
    if (!measuring) return;
    let raf = 0;
    const measure = () => {
      const layer = layerRef.current;
      const frame = layer?.parentElement;
      if (layer && frame) {
        const origin = frame.getBoundingClientRect();
        const measureEl = (el: Element | null): Box | null => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            left: r.left - origin.left,
            top: r.top - origin.top,
            width: r.width,
            height: r.height,
          };
        };
        const find = (key: TargetKey) =>
          measureEl(frame.querySelector(`[data-drag-target="${key}"]`));
        const next: Record<TargetKey, Box | null> = {
          subtitles:
            find("subtitles") ??
            subtitleFallback(origin.width, origin.height, latest.current),
          title: find("title"),
        };
        frame
          .querySelectorAll(`[data-drag-target^="${WIDGET_PREFIX}"]`)
          .forEach((el) => {
            next[el.getAttribute("data-drag-target")!] = measureEl(el);
          });
        setBoxes((prev) => {
          const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
          return [...keys].every((key) => sameBox(prev[key] ?? null, next[key] ?? null))
            ? prev
            : next;
        });
      }
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [measuring]);

  const startDrag =
    (key: TargetKey, side: Drag["side"]) =>
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      // Capture on the box so moves keep coming outside it.
      const box = (event.currentTarget.closest("[data-drag-box]") ??
        event.currentTarget) as HTMLElement;
      box.setPointerCapture(event.pointerId);
      dragRef.current = {
        key,
        side,
        startX: event.clientX,
        startY: event.clientY,
        placement: latest.current.placement,
        titleOverlay: latest.current.titleOverlay,
        timeline: latest.current.timeline,
      };
      setDragging(key);
    };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const frame = layerRef.current?.parentElement;
    if (!drag || !frame) return;
    const { width: frameWidth, height: frameHeight } =
      frame.getBoundingClientRect();
    const dxPct = ((event.clientX - drag.startX) / frameWidth) * 100;
    const dyPct = ((event.clientY - drag.startY) / frameHeight) * 100;

    if (drag.key.startsWith(WIDGET_PREFIX)) {
      const id = drag.key.slice(WIDGET_PREFIX.length);
      const start = drag.timeline.widgets.find((w) => w.id === id);
      if (!start) return;
      const defaults = WIDGET_DEFAULTS[start.kind];
      const moved =
        drag.side === 0
          ? {
              x: roundHalf(clamp((start.x ?? defaults.x) + dxPct, 0, 100)),
              y: roundHalf(clamp((start.y ?? defaults.y) + dyPct, 0, 100)),
            }
          : {
              size: Math.round(
                clamp((start.size ?? defaults.size) + drag.side * 2 * dxPct, 20, 150),
              ),
            };
      const current = latest.current.timeline;
      onTimelineChange({
        ...current,
        widgets: current.widgets.map((w) => (w.id === id ? { ...w, ...moved } : w)),
      });
      return;
    }
    if (drag.key === "subtitles") {
      const start = drag.placement;
      onPlacementChange(
        drag.side === 0
          ? {
              ...latest.current.placement,
              y: roundHalf(clamp(start.y + dyPct, 0, 100)),
            }
          : {
              ...latest.current.placement,
              width: Math.round(clamp(start.width + drag.side * 2 * dxPct, 10, 100)),
            },
      );
    } else {
      const start = drag.titleOverlay;
      onTitleOverlayChange(
        drag.side === 0
          ? {
              ...latest.current.titleOverlay,
              positionY: roundHalf(clamp(start.positionY + dyPct, 0, 100)),
            }
          : {
              ...latest.current.titleOverlay,
              width: Math.round(
                clamp(start.width + drag.side * 2 * dxPct, 10, 100),
              ),
            },
      );
    }
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(null);
  };

  const nudge = (key: TargetKey) => (event: React.KeyboardEvent) => {
    if (key.startsWith(WIDGET_PREFIX)) {
      const dx = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
      const dy = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
      if (!dx && !dy) return;
      event.preventDefault();
      const id = key.slice(WIDGET_PREFIX.length);
      const current = latest.current.timeline;
      onTimelineChange({
        ...current,
        widgets: current.widgets.map((w) => {
          if (w.id !== id) return w;
          const defaults = WIDGET_DEFAULTS[w.kind];
          return {
            ...w,
            x: clamp((w.x ?? defaults.x) + dx * KEY_STEP, 0, 100),
            y: clamp((w.y ?? defaults.y) + dy * KEY_STEP, 0, 100),
          };
        }),
      });
      return;
    }
    const direction =
      event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!direction) return;
    event.preventDefault();
    if (key === "subtitles") {
      const current = latest.current.placement;
      onPlacementChange({
        ...current,
        y: clamp(current.y + direction * KEY_STEP, 0, 100),
      });
    } else {
      const title = latest.current.titleOverlay;
      onTitleOverlayChange({
        ...title,
        positionY: clamp(title.positionY + direction * KEY_STEP, 0, 100),
      });
    }
  };

  const targets: { key: TargetKey; label: string }[] = [
    { key: "subtitles", label: "Subtitles" },
    { key: "title", label: "Hook title" },
    ...Object.keys(boxes)
      .filter((key) => key.startsWith(WIDGET_PREFIX))
      .map((key) => {
        const widget = timeline.widgets.find((w) => w.id === key.slice(WIDGET_PREFIX.length));
        return { key, label: widget?.kind === "cta" ? "Call to action" : "Speaker" };
      }),
  ];

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 z-10">
      {targets.map(({ key, label }) => {
        const box = boxes[key];
        if (!box || !measuring) return null;
        const isDragging = dragging === key;
        return (
          <div
            key={key}
            data-drag-box
            role="group"
            tabIndex={0}
            aria-label={
              key.startsWith(WIDGET_PREFIX)
                ? `${label}: drag to move it, drag a corner to resize. Arrow keys move it too.`
                : `${label}: drag to move up or down, drag a corner to resize. Arrow keys move it too.`
            }
            onPointerDown={startDrag(key, 0)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={nudge(key)}
            className={cn(
              "group/box pointer-events-auto absolute touch-none rounded-[3px] outline-none",
              isDragging ? "cursor-grabbing" : "cursor-grab",
            )}
            style={{
              left: box.left - BOX_PADDING,
              top: box.top - BOX_PADDING,
              width: box.width + BOX_PADDING * 2,
              height: box.height + BOX_PADDING * 2,
              zIndex: key === "subtitles" ? 1 : 2,
            }}
          >
            <div
              className={cn(
                "absolute inset-0 rounded-[3px] border-2 border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.35)] transition-opacity",
                isDragging
                  ? "opacity-100"
                  : "opacity-0 group-hover/box:opacity-100 group-focus-visible/box:opacity-100",
              )}
            >
              {(
                [
                  ["-top-1.5 -left-1.5", -1],
                  ["-top-1.5 -right-1.5", 1],
                  ["-bottom-1.5 -left-1.5", -1],
                  ["-bottom-1.5 -right-1.5", 1],
                ] as const
              ).map(([position, side]) => (
                <span
                  key={position}
                  aria-hidden
                  onPointerDown={startDrag(key, side)}
                  className={cn(
                    "absolute size-3 cursor-ew-resize rounded-[2px] border border-black/40 bg-white",
                    position,
                  )}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
