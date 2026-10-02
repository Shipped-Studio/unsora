"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  buildLyricTimeline,
  getActiveLyricIndex,
  type LyricTimelineLine,
} from "@/lib/music-lyrics";

interface SyncedLyricsProps {
  lyrics: string;
  currentTime: number;
  duration: number;
  isActive: boolean;
  variant?: "card" | "overlay" | "compact";
  className?: string;
}

export function SyncedLyrics({
  lyrics,
  currentTime,
  duration,
  isActive,
  variant = "card",
  className,
}: SyncedLyricsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Array<HTMLParagraphElement | null>>([]);

  const lines = useMemo<LyricTimelineLine[]>(() => {
    if (duration > 0) {
      return buildLyricTimeline(lyrics, duration);
    }

    return lyrics
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({
        text,
        startTime: 0,
        isSection: /^\[[^\]]+\]$/.test(text),
      }));
  }, [lyrics, duration]);

  const activeIndex =
    isActive && duration > 0
      ? getActiveLyricIndex(lines, currentTime)
      : -1;

  useEffect(() => {
    if (!isActive || activeIndex < 0) return;
    const activeEl = lineRefs.current[activeIndex];
    const container = containerRef.current;
    if (!activeEl || !container) return;

    const offset =
      activeEl.offsetTop -
      container.clientHeight / 2 +
      activeEl.clientHeight / 2;

    container.scrollTo({
      top: Math.max(0, offset),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [activeIndex, isActive]);

  if (lines.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/70 italic">
        No lyrics for this track
      </p>
    );
  }

  const maxHeight =
    variant === "overlay"
      ? "max-h-16"
      : variant === "compact"
        ? "max-h-14"
        : "max-h-36";

  return (
    <div
      ref={containerRef}
      className={cn(
        "no-scrollbar overflow-y-auto scroll-smooth",
        maxHeight,
        className,
      )}
    >
      <div className="flex flex-col gap-1 py-0.5">
        {lines.map((line, index) => {
          const distance =
            activeIndex >= 0 ? Math.abs(index - activeIndex) : 999;
          const isCurrent = isActive && index === activeIndex;

          return (
            <p
              key={`${line.text}-${index}`}
              ref={(el) => {
                lineRefs.current[index] = el;
              }}
              className={cn(
                "origin-left transition-all duration-300",
                line.isSection
                  ? "text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70"
                  : variant === "overlay"
                    ? "text-xs leading-relaxed"
                    : variant === "compact"
                      ? "text-[11px] leading-snug"
                      : "text-sm leading-relaxed",
                isCurrent
                  ? "scale-[1.02] font-semibold text-foreground"
                  : distance === 1
                    ? "text-foreground/70"
                    : distance === 2
                      ? "text-muted-foreground"
                      : "text-muted-foreground/45",
              )}
            >
              {line.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}
