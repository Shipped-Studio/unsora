"use client";

import { useDraggable } from "@dnd-kit/core";
import { PlatformIcon } from "@/components/scheduler/platform-icon";
import { PostThumb } from "@/components/scheduler/post-thumb";
import { formatTime } from "@/lib/scheduler/dates";
import { platformName } from "@/lib/scheduler/formats";
import type { Post } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";

export const MOVABLE = new Set(["DRAFT", "SCHEDULED", "FAILED", "PARTIALLY_PUBLISHED"]);

const STATUS_BAR: Record<Post["status"], string> = {
  DRAFT: "bg-muted-foreground/40",
  SCHEDULED: "bg-info",
  PUBLISHING: "bg-info animate-pulse",
  PUBLISHED: "bg-success",
  PARTIALLY_PUBLISHED: "bg-warning",
  FAILED: "bg-destructive",
};

const STATUS_WORD: Record<Post["status"], string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  PUBLISHING: "Publishing",
  PUBLISHED: "Published",
  PARTIALLY_PUBLISHED: "Partly published",
  FAILED: "Failed",
};

/** Status and platforms for screen readers; on screen they are a color bar and icons. */
function describe(post: Post) {
  const platforms = [...new Set(post.postAccounts.map((leg) => platformName(leg.account.provider)))];
  const list =
    platforms.length > 1
      ? `${platforms.slice(0, -1).join(", ")} and ${platforms[platforms.length - 1]}`
      : (platforms[0] ?? "");
  return list ? `${STATUS_WORD[post.status]}, ${list}` : STATUS_WORD[post.status];
}

function Providers({ post }: { post: Post }) {
  const providers = [...new Set(post.postAccounts.map((leg) => leg.account.provider))];
  return (
    <span className="flex shrink-0 -space-x-1">
      {providers.slice(0, 3).map((provider) => (
        <PlatformIcon key={provider} provider={provider} className="size-3.5 rounded-full ring-1 ring-card" />
      ))}
    </span>
  );
}

/** Visual body of a post on the calendar. Also used as the drag overlay. */
export function PostChipBody({
  post,
  timeZone,
  at,
  variant,
  className,
}: {
  post: Post;
  timeZone: string;
  /** Display time, which can differ from the post while a move is saving. */
  at: string;
  variant: "month" | "slot" | "overlay";
  className?: string;
}) {
  const caption = post.mainCaption.trim() || "No caption";
  const tone =
    post.status === "FAILED"
      ? "bg-destructive/10"
      : post.status === "PUBLISHED"
        ? "bg-secondary"
        : post.status === "DRAFT"
          ? "bg-muted"
          : "bg-accent";
  const time = (
    <span className="flex shrink-0 items-center gap-1.5">
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", STATUS_BAR[post.status])} />
      <span className="shrink-0 font-medium tabular-nums text-foreground">
        {formatTime(at, timeZone)}
      </span>
      <Providers post={post} />
    </span>
  );
  const text = (
    <span
      className={cn(
        "min-w-0 truncate text-muted-foreground",
        post.status === "FAILED" && "text-destructive",
      )}
    >
      {caption}
    </span>
  );
  return (
    <span
      className={cn(
        "flex w-full min-w-0 overflow-hidden rounded-md text-left text-xs",
        tone,
        variant === "slot"
          ? "h-full min-h-7 flex-col justify-center gap-0.5 px-2 py-1"
          : "h-6 items-center gap-1.5 px-2",
        variant === "overlay" && "h-8 w-56 shadow-md",
        className,
      )}
    >
      {time}
      {text}
    </span>
  );
}

/** A post on the calendar: click to open, drag to reschedule. */
export function PostChip({
  post,
  timeZone,
  at,
  variant,
  onOpen,
  className,
}: {
  post: Post;
  timeZone: string;
  at: string;
  variant: "month" | "slot";
  onOpen: (postId: string) => void;
  className?: string;
}) {
  const movable = MOVABLE.has(post.status);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `post:${post.id}`,
    data: { post },
    disabled: !movable,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(post.id);
      }}
      aria-label={`${post.mainCaption.slice(0, 60) || "Post"}, ${formatTime(at, timeZone)}, ${describe(post)}${movable ? ". Drag to reschedule." : ""}`}
      className={cn(
        "block w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
        movable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isDragging && "opacity-40",
        className,
      )}
    >
      <PostChipBody post={post} timeZone={timeZone} at={at} variant={variant} />
    </button>
  );
}

/** Draft in the side panel; drag it onto a day or time to schedule it. */
export function DraftCard({
  post,
  onOpen,
}: {
  post: Post;
  onOpen: (postId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `draft:${post.id}`,
    data: { post },
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={() => onOpen(post.id)}
      aria-label={`Draft: ${post.mainCaption.slice(0, 60) || "Untitled"}, ${describe(post)}. Drag onto the calendar to schedule.`}
      className={cn(
        "flex w-full cursor-grab items-center gap-2.5 rounded-xl bg-muted p-2 text-left outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <PostThumb post={post} className="size-9" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm text-foreground">
          {post.mainCaption.trim() || "No caption"}
        </span>
      </span>
      <Providers post={post} />
    </button>
  );
}
