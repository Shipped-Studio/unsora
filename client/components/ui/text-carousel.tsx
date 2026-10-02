"use client";

import { useEffect, useState, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { cn } from "@/lib/utils";

export interface TextCarouselSlide {
  tag?: string;
  title: string;
  description: string;
}

interface TextCarouselProps {
  slides: TextCarouselSlide[];
  intervalMs?: number;
  className?: string;
  showDots?: boolean;
}

export function TextCarousel({
  slides,
  intervalMs = 5000,
  className,
  showDots = true,
}: TextCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start", dragFree: false },
    [
      Autoplay({
        delay: intervalMs,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
      }),
    ],
  );

  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollTo = useCallback(
    (i: number) => emblaApi?.scrollTo(i),
    [emblaApi],
  );

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi]);

  if (slides.length === 0) return null;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex-1 overflow-hidden" ref={emblaRef}>
        <div className="flex h-full touch-pan-y">
          {slides.map((slide, i) => (
            <div
              key={i}
              className="flex h-full min-w-0 flex-[0_0_100%] flex-col pr-3"
            >
              {slide.tag && (
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {slide.tag}
                </span>
              )}
              <h4 className="mt-1 text-base font-bold leading-tight tracking-tight sm:text-lg">
                {slide.title}
              </h4>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {slide.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {showDots && slides.length > 1 && (
        <div className="mt-3 flex items-center gap-1.5">
          {slides.map((_, i) => {
            const isActive = i === selectedIndex;
            return (
              <button
                key={i}
                type="button"
                aria-label={`Show slide ${i + 1}`}
                onClick={() => scrollTo(i)}
                className={cn(
                  "h-1 rounded-full transition-all",
                  isActive
                    ? "w-6 bg-foreground"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60",
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
