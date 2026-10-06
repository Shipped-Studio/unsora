"use client";

import { useInView } from "react-intersection-observer";
import type { Icon } from "@phosphor-icons/react";
import { SHOWCASE_MEDIA, type ShowcaseItem } from "@/lib/showcase-media";
import { cn } from "@/lib/utils";

/*
 * Empty state for the image and video tools: example outputs in masonry
 * columns that scroll endlessly, alternating up and down, with the empty
 * message on top. Decorative; the message is the content.
 */

const COLUMNS = 5;

/** Narrow areas show fewer columns (container queries on the showcase). */
const COLUMN_VISIBILITY = [
  "flex",
  "flex",
  "hidden @lg:flex",
  "hidden @3xl:flex",
  "hidden @5xl:flex",
];

/** Seconds per loop, varied so the columns drift apart. */
const COLUMN_SPEED = [70, 56, 76, 62, 68];

/** Plays only while on screen; nothing downloads before it scrolls into view. */
function ShowcaseVideo({ src }: { src: string }) {
  const { ref } = useInView({
    rootMargin: "200px 0px",
    onChange: (inView, entry) => {
      const video = entry.target as HTMLVideoElement;
      if (inView && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    },
  });
  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      preload="none"
      className="size-full object-cover"
    />
  );
}

function ShowcaseTile({ item }: { item: ShowcaseItem }) {
  return (
    <div
      className="w-full shrink-0 overflow-hidden rounded-xl bg-muted"
      style={{ aspectRatio: item.aspect }}
    >
      {item.type === "video" ? (
        <ShowcaseVideo src={item.src} />
      ) : (
        <img src={item.src} alt="" loading="lazy" className="size-full object-cover" />
      )}
    </div>
  );
}

export function ToolShowcase({
  icon: IconComponent,
  title,
  description,
}: {
  icon: Icon;
  title: string;
  description: string;
}) {
  const columns = Array.from({ length: COLUMNS }, (_, c) =>
    SHOWCASE_MEDIA.filter((_, i) => i % COLUMNS === c),
  );

  return (
    <div className="@container relative flex min-h-112 flex-1 items-center justify-center overflow-hidden rounded-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex gap-3 select-none mask-[linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]"
      >
        {columns.map((items, c) => (
          <div key={c} className={cn("min-w-0 flex-1", COLUMN_VISIBILITY[c])}>
            <div
              className="flex w-full animate-showcase-scroll flex-col motion-reduce:animate-none"
              style={{
                animationDuration: `${COLUMN_SPEED[c]}s`,
                animationDirection: c % 2 ? "reverse" : "normal",
              }}
            >
              {/* Two identical halves; the loop moves the column by one half. */}
              {[0, 1].map((copy) => (
                <div key={copy} className="flex flex-col gap-3 pb-3">
                  {items.map((item) => (
                    <ShowcaseTile key={item.src} item={item} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="relative mx-4 flex max-w-sm flex-col items-center gap-2 rounded-2xl bg-background/85 px-6 py-5 text-center backdrop-blur-md">
        <span className="mb-1 grid size-10 place-items-center rounded-xl bg-muted">
          <IconComponent className="size-5" />
        </span>
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
