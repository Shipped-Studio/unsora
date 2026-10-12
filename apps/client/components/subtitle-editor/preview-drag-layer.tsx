"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { SizePositionValues } from "@/components/subtitle-editor/tabs/style-subtitles-tab";
import type { TitleOverlayConfig } from "@/components/subtitle-editor/title-overlay";

type TargetKey = "subtitles" | "title";

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
    sizePosition,
    hasSubtitles,
    compositionWidth,
  }: {
    sizePosition: SizePositionValues;
    hasSubtitles: boolean;
    compositionWidth: number;
  },
): Box | null {
  if (!hasSubtitles) return null;
  const scale = frameWidth / compositionWidth;
  const width = Math.min(sizePosition.width, compositionWidth * 0.9) * scale;
  const height = sizePosition.fontSize * 1.3 * scale;
  return {
    left: ((50 + sizePosition.xAxis) / 100) * frameWidth - width / 2,
    top: frameHeight - (sizePosition.yAxis / 100) * frameHeight - height,
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
  sizePosition: SizePositionValues;
  titleOverlay: TitleOverlayConfig;
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
  sizePosition,
  onSizePositionChange,
  titleOverlay,
  onTitleOverlayChange,
}: {
  /** Measure only while the pointer is over the preview. */
  active: boolean;
  compositionWidth: number;
  hasSubtitles: boolean;
  sizePosition: SizePositionValues;
  onSizePositionChange: (values: SizePositionValues) => void;
  titleOverlay: TitleOverlayConfig;
  onTitleOverlayChange: (config: TitleOverlayConfig) => void;
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
    sizePosition,
    titleOverlay,
    hasSubtitles,
    compositionWidth,
  });
  useEffect(() => {
    latest.current = {
      sizePosition,
      titleOverlay,
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
        const find = (key: TargetKey): Box | null => {
          const el = frame.querySelector(`[data-drag-target="${key}"]`);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            left: r.left - origin.left,
            top: r.top - origin.top,
            width: r.width,
            height: r.height,
          };
        };
        const next = {
          subtitles:
            find("subtitles") ??
            subtitleFallback(origin.width, origin.height, latest.current),
          title: find("title"),
        };
        setBoxes((prev) =>
          sameBox(prev.subtitles, next.subtitles) && sameBox(prev.title, next.title)
            ? prev
            : next,
        );
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
        sizePosition: latest.current.sizePosition,
        titleOverlay: latest.current.titleOverlay,
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
    const compW = latest.current.compositionWidth;

    if (drag.key === "subtitles") {
      const start = drag.sizePosition;
      onSizePositionChange(
        drag.side === 0
          ? {
              ...latest.current.sizePosition,
              // yAxis is the distance from the bottom, so dragging down lowers it.
              yAxis: roundHalf(clamp(start.yAxis - dyPct, 0, 95)),
            }
          : {
              ...latest.current.sizePosition,
              width: Math.round(
                clamp(
                  start.width + ((drag.side * 2 * dxPct) / 100) * compW,
                  100,
                  compW * 0.9,
                ),
              ),
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
    const direction =
      event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!direction) return;
    event.preventDefault();
    if (key === "subtitles") {
      const sp = latest.current.sizePosition;
      onSizePositionChange({
        ...sp,
        yAxis: clamp(sp.yAxis - direction * KEY_STEP, 0, 95),
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
            aria-label={`${label}: drag to move up or down, drag a corner to resize. Arrow keys move it too.`}
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
              zIndex: key === "title" ? 2 : 1,
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
