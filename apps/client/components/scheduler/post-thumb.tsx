"use client";

import { useState } from "react";
import { FilmStrip, Images, Play, TextAa } from "@phosphor-icons/react";
import type { Post } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";

/** Square preview of a post's first media, or a text marker. */
export function PostThumb({
  post,
  className,
}: {
  post: Pick<Post, "type" | "media" | "mainCaption">;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const images = post.media
    .filter((m) => m.type === "IMAGE")
    .sort((a, b) => a.order - b.order);
  const video = post.media.find((m) => m.type === "VIDEO");
  const cover = post.media.find((m) => m.type === "THUMBNAIL");

  // The inner ring keeps transparent or white artwork readable as a tile.
  const frame = cn(
    "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground",
    "after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-1 after:ring-border after:ring-inset",
    className,
  );

  if (images.length) {
    return (
      <span className={frame}>
        <Images className="absolute size-4" />
        {!broken ? (
          <img
            src={images[0].asset.url}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
            className="relative size-full bg-muted object-cover"
          />
        ) : null}
        {images.length > 1 ? (
          <span className="absolute right-0.5 bottom-0.5 flex items-center gap-0.5 rounded-full bg-scrim/60 px-1 text-2xs leading-4 text-media-foreground">
            <Images className="size-2.5" />
            {images.length}
          </span>
        ) : null}
      </span>
    );
  }

  if (video) {
    return (
      <span className={frame}>
        <FilmStrip className="absolute size-4" />
        {broken ? null : cover ? (
          <img
            src={cover.asset.url}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
            className="relative size-full object-cover"
          />
        ) : (
          <video
            src={`${video.asset.url}#t=0.5`}
            muted
            playsInline
            preload="metadata"
            onError={() => setBroken(true)}
            className="relative size-full object-cover"
          />
        )}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-4 items-center justify-center rounded-full bg-scrim/60">
            <Play weight="fill" className="size-2 text-media-foreground" />
          </span>
        </span>
      </span>
    );
  }

  return (
    <span className={frame}>
      <TextAa className="size-4" />
    </span>
  );
}
