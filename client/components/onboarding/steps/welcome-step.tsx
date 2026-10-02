"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { CAROUSEL_ITEMS } from "@/constant/onboarding";
import {
  MonitorPlay,
  ImageSquare,
  Camera,
  UserCircle,
  PaintBrush,
  Sparkle,
} from "@phosphor-icons/react";

const CAROUSEL_ICONS: Record<string, React.ElementType> = {
  "video-generator": MonitorPlay,
  "image-generator": ImageSquare,
  "ai-influencer": Camera,
  "ai-avatar": UserCircle,
  "motion-control": PaintBrush,
};

const CAROUSEL_BG = [
  "bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-900",
  "bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-950",
  "bg-gradient-to-br from-stone-800 via-stone-700 to-stone-900",
  "bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-900",
  "bg-gradient-to-br from-neutral-950 via-neutral-800 to-neutral-900",
];

export function WelcomeStep() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const goTo = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % CAROUSEL_ITEMS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [isPaused]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-4 sm:py-8">
      <div className="mb-5 flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3.5 py-1.5 backdrop-blur-sm">
        <Sparkle size={14} weight="fill" className="text-primary" />
        <span className="text-xs font-medium text-muted-foreground">
          New Features Available
        </span>
      </div>

      <h1 className="mb-2.5 text-center text-3xl font-bold tracking-tight text-foreground sm:text-[40px] sm:leading-[1.15]">
        Create Stunning Content with AI
      </h1>
      <p className="mb-8 max-w-md text-center text-sm leading-relaxed text-muted-foreground sm:mb-10 sm:text-[15px]">
        Explore our newest AI-powered tools for video, image, and audio
        creation.
      </p>

      <div
        className="relative mb-6 w-full max-w-lg overflow-hidden rounded-2xl border border-border shadow-lg shadow-black/5"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl">
          {CAROUSEL_ITEMS.map((carouselItem, i) => {
            const CarouselIcon =
              CAROUSEL_ICONS[carouselItem.id] ?? MonitorPlay;
            return (
              <div
                key={carouselItem.id}
                aria-hidden={i !== activeIndex}
                className={cn(
                  "absolute inset-0 transition-opacity duration-700 ease-out",
                  CAROUSEL_BG[i % CAROUSEL_BG.length],
                  i === activeIndex ? "z-10 opacity-100" : "z-0 opacity-0"
                )}
              >
                <div className="absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute -bottom-20 -left-20 size-48 rounded-full bg-white/5 blur-3xl" />

                <div className="absolute inset-0 flex items-center justify-center">
                  <CarouselIcon
                    size={140}
                    weight="thin"
                    className="text-white/10"
                  />
                </div>

                <div
                  className="absolute inset-0 opacity-[0.04]"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                  }}
                />

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent p-5 sm:p-6">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-base font-semibold text-white sm:text-lg">
                        {carouselItem.name}
                      </p>
                      <p className="text-xs text-white/60 sm:text-sm">
                        {carouselItem.description}
                      </p>
                    </div>
                    {carouselItem.badge && (
                      <span className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground">
                        {carouselItem.badge}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {CAROUSEL_ITEMS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              i === activeIndex
                ? "w-6 bg-primary"
                : "w-2 bg-muted hover:bg-muted-foreground/40"
            )}
          />
        ))}
      </div>
    </div>
  );
}
