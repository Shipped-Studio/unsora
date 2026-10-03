"use client";

import Link from "next/link";
import { FilmStrip, Image as ImageIcon } from "@phosphor-icons/react";
import { LibraryItemIcon } from "@/components/files/library-card";
import { buttonVariants } from "@/components/ui/button";
import { isLibraryItemReady, libraryItemTitle, type LibraryItem } from "@/hooks/use-library";
import { scheduleHref } from "@/lib/scheduler/formats";

/** Small square preview of a library item, drawn on a card surface. */
export function AgentMediaThumb({ item }: { item: LibraryItem }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-card text-muted-foreground">
      {item.thumbnailUrl || (item.mediaType === "image" && item.url) ? (
        <img
          src={item.thumbnailUrl ?? item.url!}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      ) : item.mediaType === "video" && item.url ? (
        <video
          src={`${item.url}#t=0.5`}
          muted
          playsInline
          preload="metadata"
          className="size-full object-cover"
        />
      ) : item.mediaType === "video" ? (
        <FilmStrip className="size-4" />
      ) : item.mediaType === "image" ? (
        <ImageIcon className="size-4" />
      ) : (
        <LibraryItemIcon item={item} className="size-4" />
      )}
    </span>
  );
}

/**
 * One row of agent-made media: thumbnail, title, a meta line and a Schedule
 * action when the file is ready. Used on Home and on the Agents page.
 */
export function AgentMediaRow({
  item,
  meta,
  href,
}: {
  item: LibraryItem;
  meta: React.ReactNode;
  /** Makes the title a link, e.g. to the item in the Library. */
  href?: string;
}) {
  const title = libraryItemTitle(item);
  const canSchedule =
    isLibraryItemReady(item) && (item.mediaType === "video" || item.mediaType === "image");

  return (
    <li className="flex min-w-0 items-center gap-3 px-3 py-2.5">
      <AgentMediaThumb item={item} />
      <span className="min-w-0 flex-1">
        {href ? (
          <Link
            href={href}
            className="block truncate rounded-xs text-sm text-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {title}
          </Link>
        ) : (
          <span className="block truncate text-sm text-foreground">{title}</span>
        )}
        <span className="block truncate text-xs text-muted-foreground">{meta}</span>
      </span>
      {canSchedule ? (
        <Link
          href={scheduleHref({ url: item.url!, mediaType: item.mediaType })}
          className={buttonVariants({ variant: "outline", size: "xs" })}
        >
          Schedule
        </Link>
      ) : null}
    </li>
  );
}

/** List surface for AgentMediaRow. */
export function AgentMediaList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-card overflow-hidden rounded-xl bg-muted">{children}</ul>;
}
