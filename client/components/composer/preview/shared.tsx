"use client";

import { isValidElement, useState, type ComponentType, type ReactNode } from "react";
import { BatteryFull, CellSignalFull, WifiHigh } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { accountHandle, accountLabel } from "@/components/scheduler/account-avatar";
import type { ComposerState, MediaItem } from "@/lib/scheduler/composer-state";
import type { ConnectedAccount } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";

export interface PreviewProps {
  account: ConnectedAccount;
  state: ComposerState;
  caption: string;
}

export type IconType = ComponentType<{ className?: string; weight?: "regular" | "fill" | "bold" }>;

/** Display name, and the username without its "@". */
export function names(account: ConnectedAccount) {
  const handle = accountHandle(account);
  return {
    name: accountLabel(account),
    username: handle?.replace(/^@/, "") ?? accountLabel(account).toLowerCase().replace(/\s+/g, ""),
    handle: handle ?? `@${accountLabel(account).toLowerCase().replace(/\s+/g, "")}`,
  };
}

export function mediaOf(state: ComposerState) {
  const video = state.format === "text" ? undefined : state.media.find((m) => m.kind === "video");
  const images = state.format === "text" ? [] : state.media.filter((m) => m.kind === "image");
  const poster =
    state.cover?.previewUrl ?? (state.format === "slideshow" ? images[state.coverIndex]?.previewUrl : undefined);
  return { video, images, poster, hasMedia: Boolean(video || images.length) };
}

/** Width over height, clamped to what the platform will show in a feed. */
export function ratioOf(item: MediaItem | undefined, min: number, max: number, fallback = 1) {
  const ratio = item?.width && item?.height ? item.width / item.height : fallback;
  return Math.min(max, Math.max(min, ratio));
}

export function isVertical(item: MediaItem | undefined) {
  return item?.width && item?.height ? item.height > item.width : true;
}

/** The phone screen every preview is drawn inside. */
export function Phone({
  children,
  dark,
  statusOverlay,
  className,
}: {
  children: ReactNode;
  /** Full-bleed video apps draw on black. */
  dark?: boolean;
  /** Draw the status bar on top of the content instead of above it. */
  statusOverlay?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto flex aspect-[9/17.5] w-full max-w-[300px] flex-col overflow-hidden rounded-[1.75rem] border-[5px] border-media shadow-lg shadow-foreground/10 ring-1 ring-border",
        dark ? "bg-media text-media-foreground" : "bg-card text-card-foreground",
        className,
      )}
    >
      <StatusBar overlay={statusOverlay} dark={dark} />
      {children}
    </div>
  );
}

function StatusBar({ overlay, dark }: { overlay?: boolean; dark?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "z-30 flex h-7 shrink-0 items-center justify-between px-5 text-[11px] font-semibold",
        overlay && "absolute inset-x-0 top-0",
        dark ? "text-media-foreground" : "text-foreground",
      )}
    >
      <span className="tabular-nums">9:41</span>
      <span className="flex items-center gap-1">
        <CellSignalFull weight="fill" className="size-3" />
        <WifiHigh weight="bold" className="size-3" />
        <BatteryFull weight="fill" className="size-4" />
      </span>
    </div>
  );
}

/** Scrollable app content between the top and bottom bars. */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto no-scrollbar", className)}>{children}</div>;
}

export function BottomNav({
  items,
  dark,
  className,
}: {
  items: { icon: IconType | ReactNode; label?: string; active?: boolean }[];
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "z-20 flex shrink-0 items-center justify-around px-2 pt-1.5 pb-3",
        dark ? "bg-media text-media-foreground" : "border-t border-border/60 bg-card text-foreground",
        className,
      )}
    >
      {items.map(({ icon: Icon, label, active }, index) => (
        <span
          key={index}
          className={cn(
            "flex flex-col items-center gap-0.5 text-[9px]",
            !active && (dark ? "text-media-foreground/70" : "text-muted-foreground"),
          )}
        >
          {isValidElement(Icon) ? (
            Icon
          ) : (
            <NavIcon icon={Icon as IconType} active={active} />
          )}
          {label ? <span>{label}</span> : null}
        </span>
      ))}
    </div>
  );
}

function NavIcon({ icon: Icon, active }: { icon: IconType; active?: boolean }) {
  return <Icon className="size-5" weight={active ? "fill" : "regular"} />;
}

export function ProfilePic({
  account,
  className,
}: {
  account: ConnectedAccount;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-8 shrink-0", className)}>
      {account.profilePicture ? <AvatarImage src={account.profilePicture} alt="" /> : null}
      <AvatarFallback className="bg-secondary text-[11px] font-semibold text-foreground">
        {accountLabel(account).slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

function clip(text: string, chars: number, lines: number) {
  let end = text.length;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n" && ++seen >= lines) {
      end = i;
      break;
    }
  }
  end = Math.min(end, chars);
  if (end >= text.length) return null;
  // Cut on a word boundary, like the apps do.
  const slice = text.slice(0, end);
  const space = slice.lastIndexOf(" ");
  return (space > end * 0.6 ? slice.slice(0, space) : slice).trimEnd();
}

const TOKEN = /(#[\p{L}\p{N}_]+|@[\w.]+|https?:\/\/[^\s]+)/gu;

function linkify(text: string, linkClass?: string) {
  if (!linkClass) return text;
  return text.split(TOKEN).map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className={linkClass}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/**
 * Caption text cut where the platform cuts it, with the platform's "more"
 * label, and hashtags, mentions and links in the platform's link color.
 */
export function Caption({
  text,
  chars,
  lines = 99,
  more = "more",
  moreClassName = "text-muted-foreground",
  ellipsis = "… ",
  linkClassName,
  lead,
  placeholder = "Your caption appears here",
  className,
  as: Tag = "p",
}: {
  text: string;
  chars: number;
  lines?: number;
  more?: string;
  moreClassName?: string;
  ellipsis?: string;
  linkClassName?: string;
  /** Rendered before the text, like Instagram's bold username. */
  lead?: ReactNode;
  placeholder?: string;
  className?: string;
  as?: "p" | "div" | "span";
}) {
  const [open, setOpen] = useState(false);
  const trimmed = text.trim();
  const cut = open ? null : clip(trimmed, chars, lines);
  return (
    <Tag className={cn("break-words whitespace-pre-wrap", className)}>
      {lead}
      {trimmed ? (
        linkify(cut ?? trimmed, linkClassName)
      ) : (
        <span className="opacity-60">{placeholder}</span>
      )}
      {cut !== null ? (
        <>
          {ellipsis}
          <button type="button" className={moreClassName} onClick={() => setOpen(true)}>
            {more}
          </button>
        </>
      ) : null}
    </Tag>
  );
}

/** Which image of a carousel is showing. */
export function useCarousel(count: number) {
  const [index, setIndex] = useState(0);
  const current = Math.min(index, Math.max(0, count - 1));
  return {
    index: current,
    setIndex,
    next: () => setIndex((current + 1) % Math.max(1, count)),
    prev: () => setIndex((current - 1 + count) % Math.max(1, count)),
  };
}

/** A still or playing piece of media filling its box. */
export function MediaFill({
  item,
  poster,
  fit = "cover",
  className,
}: {
  item: MediaItem | undefined;
  poster?: string;
  fit?: "cover" | "contain";
  className?: string;
}) {
  const fitClass = fit === "cover" ? "object-cover" : "object-contain";
  if (!item) {
    return (
      <div className={cn("flex size-full items-center justify-center bg-muted text-xs text-muted-foreground", className)}>
        Add media to preview
      </div>
    );
  }
  if (item.kind === "video") {
    return (
      <video
        key={item.previewUrl}
        src={item.previewUrl}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        className={cn("size-full bg-media", fitClass, className)}
      />
    );
  }
  return <img src={item.previewUrl} alt="" className={cn("size-full", fitClass, className)} />;
}

/** Tap the left or right half to move through a carousel, like on a phone. */
export function TapZones({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  return (
    <>
      <button type="button" aria-label="Previous image" onClick={onPrev} className="absolute inset-y-0 left-0 z-10 w-1/3" />
      <button type="button" aria-label="Next image" onClick={onNext} className="absolute inset-y-0 right-0 z-10 w-1/3" />
    </>
  );
}

export function Dots({
  count,
  index,
  className,
  activeClassName = "bg-primary",
  idleClassName = "bg-muted-foreground/40",
}: {
  count: number;
  index: number;
  className?: string;
  activeClassName?: string;
  idleClassName?: string;
}) {
  if (count < 2) return null;
  return (
    <div aria-hidden className={cn("flex justify-center gap-1", className)}>
      {Array.from({ length: Math.min(count, 10) }).map((_, i) => (
        <span key={i} className={cn("size-1.5 rounded-full", i === index ? activeClassName : idleClassName)} />
      ))}
    </div>
  );
}

/**
 * Photo layouts used by Facebook, LinkedIn and Bluesky: one image at its own
 * shape, two side by side, three as one big plus two, four or more as a
 * two by two grid with a "+N" tile.
 */
export function PhotoGrid({
  items,
  rounded,
  gap = "gap-0.5",
  single = { min: 0.8, max: 1.91 },
}: {
  items: MediaItem[];
  rounded?: string;
  gap?: string;
  single?: { min: number; max: number };
}) {
  if (!items.length) return null;
  if (items.length === 1) {
    return (
      <div className={cn("overflow-hidden bg-muted", rounded)} style={{ aspectRatio: ratioOf(items[0], single.min, single.max) }}>
        <MediaFill item={items[0]} />
      </div>
    );
  }
  if (items.length === 2) {
    return (
      <div className={cn("grid aspect-[2/1.2] grid-cols-2 overflow-hidden", gap, rounded)}>
        {items.map((item) => (
          <MediaFill key={item.key} item={item} />
        ))}
      </div>
    );
  }
  if (items.length === 3) {
    return (
      <div className={cn("grid aspect-square grid-cols-2 grid-rows-2 overflow-hidden", gap, rounded)}>
        <MediaFill item={items[0]} className="row-span-2" />
        <MediaFill item={items[1]} />
        <MediaFill item={items[2]} />
      </div>
    );
  }
  const extra = items.length - 4;
  return (
    <div className={cn("grid aspect-square grid-cols-2 grid-rows-2 overflow-hidden", gap, rounded)}>
      {items.slice(0, 4).map((item, index) => (
        <div key={item.key} className="relative min-h-0">
          <MediaFill item={item} />
          {index === 3 && extra > 0 ? (
            <span className="absolute inset-0 flex items-center justify-center bg-scrim/50 text-xl font-semibold text-media-foreground">
              +{extra}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
