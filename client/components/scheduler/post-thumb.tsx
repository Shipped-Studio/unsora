import { Images, Play, TextAa } from "@phosphor-icons/react/dist/ssr";
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
  const images = post.media
    .filter((m) => m.type === "IMAGE")
    .sort((a, b) => a.order - b.order);
  const video = post.media.find((m) => m.type === "VIDEO");
  const cover = post.media.find((m) => m.type === "THUMBNAIL");

  const frame = cn(
    "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground",
    className,
  );

  if (images.length) {
    return (
      <span className={frame}>
        <img
          src={images[0].asset.url}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
        {images.length > 1 ? (
          <span className="absolute right-0.5 bottom-0.5 flex items-center gap-0.5 rounded bg-scrim/60 px-1 text-[10px] leading-4 text-media-foreground">
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
        {cover ? (
          <img src={cover.asset.url} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <video
            src={`${video.asset.url}#t=0.5`}
            muted
            playsInline
            preload="metadata"
            className="size-full object-cover"
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
