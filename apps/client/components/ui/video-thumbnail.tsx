"use client";

import { FilmStrip } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

import Image from "next/image";
import { useInView } from "react-intersection-observer";

const cdnLoader = ({ src }: { src: string }) => src;

interface VideoThumbnailProps {
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  alt: string;
  /** Seek the video to this time (seconds) to use as the poster frame. */
  seekTo?: number;
  /** Placeholder surface, e.g. "bg-card" when the thumbnail sits on a muted tile. */
  className?: string;
}

/**
 * Grid-card media preview. Renders a static thumbnail image when one exists;
 * otherwise mounts a <video> only while the card is near the viewport, so
 * offscreen cards hold no media connections or decoders.
 */
export function VideoThumbnail({
  videoUrl,
  thumbnailUrl,
  alt,
  seekTo,
  className,
}: VideoThumbnailProps) {
  const { ref, inView } = useInView({ rootMargin: "300px 0px" });

  if (thumbnailUrl) {
    return (
      <Image
        loader={cdnLoader}
        src={thumbnailUrl}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        className="object-cover"
      />
    );
  }

  return (
    <div ref={ref} className={cn("relative flex size-full items-center justify-center bg-muted", className)}>
      <FilmStrip aria-hidden className="size-6 text-muted-foreground" />
      {inView && videoUrl && (
        <video
          src={videoUrl}
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 size-full object-cover"
          onLoadedMetadata={
            seekTo !== undefined
              ? (e) => {
                  e.currentTarget.currentTime = seekTo;
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
