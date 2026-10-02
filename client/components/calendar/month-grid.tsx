"use client";

import Link from "next/link";
import { useDroppable } from "@dnd-kit/core";
import { format, isSameDay, isSameMonth } from "date-fns";
import { Plus } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PostChip } from "./post-chip";
import { dayId, toUtc } from "@/lib/scheduler/calendar";
import type { Post } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";

export interface PlacedPost {
  post: Post;
  /** ISO time the post shows at (a pending move wins over the saved time). */
  at: string;
  /** Naive date in the calendar zone. */
  local: Date;
}

const MAX_VISIBLE = 3;

function DayCell({
  day,
  anchor,
  today,
  posts,
  timeZone,
  onOpen,
  newPostHref,
}: {
  day: Date;
  anchor: Date;
  today: Date;
  posts: PlacedPost[];
  timeZone: string;
  onOpen: (postId: string) => void;
  newPostHref: (day: Date) => string;
}) {
  const isPast = day < today;
  const { setNodeRef, isOver } = useDroppable({
    id: `day:${dayId(day)}`,
    disabled: isPast,
  });
  const inMonth = isSameMonth(day, anchor);
  const isToday = isSameDay(day, today);
  const visible = posts.slice(0, MAX_VISIBLE);
  const hidden = posts.length - visible.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group/day relative flex min-h-28 flex-col gap-1 rounded-lg border p-1.5 transition-colors",
        isPast ? "border-transparent bg-hatch" : "border-border/70 bg-card hover:border-primary/30",
        !inMonth && !isPast && "bg-muted/50",
        isOver && "border-primary/50 bg-accent",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-sm tabular-nums",
            isToday
              ? "bg-primary font-semibold text-primary-foreground"
              : inMonth
                ? "text-foreground"
                : "text-muted-foreground",
          )}
        >
          {format(day, "d")}
        </span>
        {!isPast ? (
          <Link
            href={newPostHref(day)}
            aria-label={`New post on ${format(day, "MMMM d")}`}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover/day:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100"
          >
            <Plus className="size-3.5" />
          </Link>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        {visible.map(({ post, at }) => (
          <PostChip
            key={post.id}
            post={post}
            timeZone={timeZone}
            at={at}
            variant="month"
            onOpen={onOpen}
          />
        ))}
        {hidden > 0 ? (
          <Popover>
            <PopoverTrigger className="rounded px-1.5 text-left text-[13px] text-muted-foreground hover:text-foreground">
              {hidden} more
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 gap-1.5 p-2">
              <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                {format(day, "EEEE, MMMM d")}
              </p>
              {posts.map(({ post, at }) => (
                <PostChip
                  key={post.id}
                  post={post}
                  timeZone={timeZone}
                  at={at}
                  variant="month"
                  onOpen={onOpen}
                />
              ))}
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
    </div>
  );
}

export function MonthGrid({
  days,
  anchor,
  today,
  postsByDay,
  timeZone,
  weekStartsOn,
  onOpen,
}: {
  days: Date[];
  anchor: Date;
  today: Date;
  postsByDay: Map<string, PlacedPost[]>;
  timeZone: string;
  weekStartsOn: 0 | 1;
  onOpen: (postId: string) => void;
}) {
  const weekdays = days.slice(0, 7).map((day) => format(day, "EEE"));
  const newPostHref = (day: Date) => {
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0);
    return `/scheduler/new?date=${encodeURIComponent(toUtc(at, timeZone).toISOString())}`;
  };

  return (
    <div className="space-y-2" data-week-starts={weekStartsOn}>
      <div className="grid grid-cols-7 gap-2">
        {weekdays.map((name) => (
          <div
            key={name}
            className="rounded-lg bg-muted px-2 py-2.5 text-center text-sm font-medium text-muted-foreground"
          >
            {name}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => (
          <DayCell
            key={dayId(day)}
            day={day}
            anchor={anchor}
            today={today}
            posts={postsByDay.get(dayId(day)) ?? []}
            timeZone={timeZone}
            onOpen={onOpen}
            newPostHref={newPostHref}
          />
        ))}
      </div>
    </div>
  );
}
