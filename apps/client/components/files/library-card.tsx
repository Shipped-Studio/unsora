"use client";

import Image from "next/image";
import { formatDistanceToNowStrict } from "date-fns";
import { Check, FileText, MusicNotes, Waveform } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoThumbnail } from "@/components/ui/video-thumbnail";
import {
  formatLibraryDuration,
  libraryItemTitle,
  libraryKindLabel,
  type LibraryItem,
} from "@/hooks/use-library";
import { cn } from "@/lib/utils";

const cdnLoader = ({ src }: { src: string }) => src;

/** "3 hours ago". */
export function libraryRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

/** Icon for items without a visual preview. */
export function LibraryItemIcon({
  item,
  className,
}: {
  item: Pick<LibraryItem, "kind" | "mediaType">;
  className?: string;
}) {
  if (item.mediaType === "document") return <FileText className={className} />;
  if (item.kind === "music") return <MusicNotes className={className} />;
  return <Waveform className={className} />;
}

/** Selection state for picker cards. Cards act as checkboxes. */
export interface LibrarySelection {
  selected: boolean;
  /** At the selection limit: unselected items can't be picked. */
  disabled?: boolean;
}

function selectionProps(selection?: LibrarySelection) {
  if (!selection) return {};
  return {
    role: "checkbox",
    "aria-checked": selection.selected,
    disabled: selection.disabled && !selection.selected,
  };
}

function SelectionMark({
  selection,
  className,
}: {
  selection: LibrarySelection;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-5 items-center justify-center rounded-full border transition-colors",
        selection.selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card text-transparent",
        className,
      )}
    >
      <Check className="size-3" weight="bold" />
    </span>
  );
}

/** The media area of a card: thumbnail, video frame or a type icon. */
export function LibraryMedia({ item }: { item: LibraryItem }) {
  const title = libraryItemTitle(item);

  if (item.mediaType === "image" && (item.thumbnailUrl || item.url)) {
    return (
      <Image
        loader={cdnLoader}
        src={(item.thumbnailUrl || item.url) as string}
        alt={title}
        fill
        sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        className="object-cover"
      />
    );
  }

  if (item.mediaType === "video") {
    return (
      <VideoThumbnail
        className="bg-card"
        videoUrl={item.url}
        thumbnailUrl={item.thumbnailUrl}
        alt={title}
        seekTo={item.thumbnailUrl ? undefined : 0.1}
      />
    );
  }

  return (
    <div className="flex size-full items-center justify-center text-muted-foreground">
      <LibraryItemIcon item={item} className="size-8" />
    </div>
  );
}

function ApiMarker({ className }: { className?: string }) {
  return (
    <Badge variant="secondary" className={className} title="Made with the API or an agent">
      API
    </Badge>
  );
}

/** The one style for labels drawn on top of media (duration, API). */
const MEDIA_CHIP =
  "rounded-md bg-scrim/60 px-1.5 py-0.5 text-2xs font-medium text-media-foreground tabular-nums";

/** Multi-select on the Library page: a checkbox next to each card. */
export interface LibraryBulkSelect {
  selected: boolean;
  /** Something is selected, so clicks toggle instead of opening. */
  active: boolean;
  /** `range` is true when Shift was held. */
  onToggle: (range: boolean) => void;
}

interface LibraryCardProps {
  item: LibraryItem;
  onClick: () => void;
  /** Picker mode: the whole card is a checkbox. */
  selection?: LibrarySelection;
  /** Page mode: a separate, always-visible checkbox. */
  bulk?: LibraryBulkSelect;
  className?: string;
}

function BulkCheckbox({
  bulk,
  title,
  className,
}: {
  bulk: LibraryBulkSelect;
  title: string;
  className?: string;
}) {
  return (
    <Checkbox
      checked={bulk.selected}
      aria-label={`Select ${title}`}
      onClick={(event) => bulk.onToggle(event.shiftKey)}
      // Always visible (no hover reveal): a subtle white box in the corner.
      className={cn("size-5 rounded-md bg-card dark:bg-card", className)}
    />
  );
}

function handleCardClick(
  event: React.MouseEvent,
  onClick: () => void,
  bulk?: LibraryBulkSelect,
) {
  if (bulk && (bulk.active || event.shiftKey)) {
    event.preventDefault();
    bulk.onToggle(event.shiftKey);
    return;
  }
  onClick();
}

/** Square grid card for video, image and other files. */
export function LibraryCard({
  item,
  onClick,
  selection,
  bulk,
  className,
}: LibraryCardProps) {
  const title = libraryItemTitle(item);
  const duration =
    item.mediaType === "video" || item.mediaType === "audio"
      ? formatLibraryDuration(item.duration)
      : null;
  const selected = selection?.selected || bulk?.selected;

  const card = (
    <button
      type="button"
      onClick={(event) => handleCardClick(event, onClick, bulk)}
      {...selectionProps(selection)}
      aria-label={title}
      aria-haspopup={selection || bulk?.active ? undefined : "dialog"}
      className={cn(
        "group flex w-full min-w-0 flex-col rounded-xl bg-muted p-1.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        selected && "ring-2 ring-primary",
        !bulk && className,
      )}
    >
      {/* Media sits on a card-colored inset with its own inner radius; the
          video placeholder is recolored so it doesn't vanish into the tile. */}
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-card">
        <LibraryMedia item={item} />
        {selection ? (
          <SelectionMark selection={selection} className="absolute top-2 left-2" />
        ) : null}
        {item.source === "api" ? (
          <span
            className={cn(MEDIA_CHIP, "absolute top-2 right-2")}
            title="Made with the API or an agent"
          >
            API
          </span>
        ) : null}
        {duration ? (
          <span className={cn(MEDIA_CHIP, "absolute right-2 bottom-2")}>{duration}</span>
        ) : null}
      </div>
      <div className="min-w-0 space-y-0.5 px-1 pt-2 pb-0.5">
        <p className="truncate text-sm text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {libraryKindLabel(item.kind)} · {libraryRelativeDate(item.createdAt)}
        </p>
      </div>
    </button>
  );

  if (!bulk) return card;
  return (
    <div className={cn("group/card relative min-w-0", className)}>
      {card}
      <BulkCheckbox bulk={bulk} title={title} className="absolute top-2 left-2 z-10" />
    </div>
  );
}

/** Compact row for audio files. */
export function LibraryAudioRow({
  item,
  onClick,
  selection,
  bulk,
  className,
}: LibraryCardProps) {
  const title = libraryItemTitle(item);
  const duration = formatLibraryDuration(item.duration);
  const selected = selection?.selected || bulk?.selected;

  const row = (
    <button
      type="button"
      onClick={(event) => handleCardClick(event, onClick, bulk)}
      {...selectionProps(selection)}
      aria-label={title}
      aria-haspopup={selection || bulk?.active ? undefined : "dialog"}
      className={cn(
        "flex w-full min-w-0 items-center gap-3 rounded-xl bg-muted p-2.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        selected && "ring-2 ring-primary",
        !bulk && className,
      )}
    >
      {selection ? <SelectionMark selection={selection} /> : null}
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground">
        <LibraryItemIcon item={item} className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {libraryKindLabel(item.kind)} · {libraryRelativeDate(item.createdAt)}
        </span>
      </span>
      {item.source === "api" ? <ApiMarker /> : null}
      {duration ? (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {duration}
        </span>
      ) : null}
    </button>
  );

  if (!bulk) return row;
  return (
    <div className={cn("group/card flex min-w-0 items-center gap-2", className)}>
      <BulkCheckbox bulk={bulk} title={title} className="shrink-0" />
      {row}
    </div>
  );
}

export const LIBRARY_GRID_CLASS =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";

export const LIBRARY_ROWS_CLASS = "grid gap-2 lg:grid-cols-2";

/** Loading placeholder shaped like the grid or the audio rows. */
export function LibrarySkeleton({
  layout = "grid",
  count = 12,
  className,
}: {
  layout?: "grid" | "rows";
  count?: number;
  className?: string;
}) {
  if (layout === "rows") {
    return (
      <div className={cn(LIBRARY_ROWS_CLASS, className)} aria-hidden>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl bg-muted p-2.5">
            <Skeleton className="size-10 shrink-0 rounded-lg bg-card" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn(LIBRARY_GRID_CLASS, className)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl bg-muted p-1.5">
          <Skeleton className="aspect-square w-full rounded-lg bg-card" />
          <div className="space-y-1.5 px-1 pt-2 pb-0.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** "Load more" for Library lists, with an inline retry when a page fails. */
export function LoadMore({
  hasNextPage,
  isFetchingNextPage,
  isError,
  onLoadMore,
  className,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  onLoadMore: () => void;
  className?: string;
}) {
  if (!hasNextPage && !isError) return null;
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {isError ? (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load more files.
        </p>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={onLoadMore}
        disabled={isFetchingNextPage}
      >
        {isFetchingNextPage ? "Loading…" : isError ? "Try again" : "Load more"}
      </Button>
    </div>
  );
}
