"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDroppable } from "@dnd-kit/core";
import { format, isSameDay } from "date-fns";
import { PostChip } from "./post-chip";
import type { PlacedPost } from "./month-grid";
import {
  HOUR_HEIGHT,
  SLOT_MINUTES,
  dayId,
  toUtc,
} from "@/lib/scheduler/calendar";
import type { PostingSlot } from "@/hooks/use-schedule";
import { cn } from "@/lib/utils";

const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;
const SLOT_HEIGHT = (HOUR_HEIGHT * SLOT_MINUTES) / 60;
const pad = (n: number) => String(n).padStart(2, "0");
const slotTop = (minutes: number) => Math.floor(minutes / SLOT_MINUTES) * SLOT_HEIGHT;

function slotKey(day: Date, index: number) {
  const minutes = index * SLOT_MINUTES;
  return `${dayId(day)}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function Slot({
  day,
  index,
  disabled,
  onCreate,
}: {
  day: Date;
  index: number;
  disabled: boolean;
  onCreate: (key: string) => void;
}) {
  const key = slotKey(day, index);
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${key}`, disabled });
  return (
    <button
      ref={setNodeRef}
      type="button"
      tabIndex={-1}
      disabled={disabled}
      onClick={() => onCreate(key)}
      aria-label={`New post at ${key.replace("T", " ")}`}
      style={{ height: SLOT_HEIGHT }}
      className={cn(
        "block w-full py-1 text-left outline-none",
        "before:block before:h-full before:rounded-lg before:border before:transition-colors",
        disabled
          ? "cursor-default before:border-transparent before:bg-hatch"
          : "before:border-border/70 before:bg-card hover:before:border-primary/30 hover:before:bg-accent",
        isOver && "before:border-primary/50 before:bg-accent",
      )}
    />
  );
}

/** Posts sit inside their hour cell; several in one hour sit side by side. */
function layoutDay(posts: PlacedPost[]) {
  const groups = new Map<number, PlacedPost[]>();
  for (const placed of posts) {
    const minutes = placed.local.getHours() * 60 + placed.local.getMinutes();
    const slot = Math.floor(minutes / SLOT_MINUTES);
    groups.set(slot, [...(groups.get(slot) ?? []), placed]);
  }
  const inner = SLOT_HEIGHT - 16;
  return [...groups.values()].flatMap((group) => {
    const cellTop = slotTop(group[0].local.getHours() * 60 + group[0].local.getMinutes()) + 8;
    // Two posts stack as single lines; three or more sit side by side.
    const stacked = group.length === 2;
    return group.map((placed, index) => ({
      placed,
      compact: group.length > 1,
      top: stacked ? cellTop + index * (inner / 2 + 1) : cellTop,
      height: stacked ? inner / 2 - 1 : inner,
      left: stacked ? "0%" : `${(index / group.length) * 100}%`,
      width: stacked ? "100%" : `${100 / group.length}%`,
    }));
  });
}

export function TimeGrid({
  days,
  today,
  now,
  postsByDay,
  queueSlots,
  timeZone,
  onOpen,
}: {
  days: Date[];
  today: Date;
  /** Naive "now" in the calendar zone. */
  now: Date;
  postsByDay: Map<string, PlacedPost[]>;
  queueSlots: PostingSlot[];
  timeZone: string;
  onOpen: (postId: string) => void;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  // Start the view at 7:00, or earlier if something is scheduled before that.
  useEffect(() => {
    if (scrolled.current || !scrollRef.current) return;
    let earliest = 7 * 60;
    for (const day of days) {
      for (const { local } of postsByDay.get(dayId(day)) ?? []) {
        earliest = Math.min(earliest, local.getHours() * 60 + local.getMinutes());
      }
    }
    scrollRef.current.scrollTop = Math.max(0, (earliest / 60 - 0.5) * HOUR_HEIGHT);
    scrolled.current = true;
  }, [days, postsByDay]);

  const create = (key: string) => {
    const [date, time] = key.split("T");
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    let at = toUtc(new Date(y, m - 1, d, hh, mm), timeZone);
    if (at.getTime() < Date.now() + 60_000) {
      const quarter = 15 * 60_000;
      at = new Date(Math.ceil((Date.now() + 5 * 60_000) / quarter) * quarter);
    }
    router.push(`/scheduler/new?date=${encodeURIComponent(at.toISOString())}`);
  };

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <div
      ref={scrollRef}
      className="relative max-h-[calc(100svh-13rem)] min-h-96 overflow-y-auto overscroll-contain"
    >
      <div className="sticky top-0 z-20 grid gap-2 bg-card pb-1" style={{ gridTemplateColumns: `4.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
        <div className="rounded-lg bg-muted" />
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={dayId(day)} className="rounded-lg bg-muted px-2 py-2.5 text-center">
              <p className="truncate text-sm text-muted-foreground">
                <span className="hidden lg:inline">{format(day, "EEEE")}</span>
                <span className="lg:hidden">{format(day, "EEE")}</span>
              </p>
              <p
                className={cn(
                  "mt-0.5 inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold tabular-nums",
                  isToday ? "text-accent-foreground" : "text-foreground",
                )}
              >
                {isToday ? <span aria-hidden className="size-1.5 rounded-full bg-primary" /> : null}
                {format(day, "MMM d")}
              </p>
            </div>
          );
        })}
      </div>

      <div className="relative">
        <div className="grid gap-x-2" style={{ gridTemplateColumns: `4.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <div>
            {Array.from({ length: 24 }).map((_, hour) => (
              <div
                key={hour}
                style={{ height: HOUR_HEIGHT }}
                className="flex items-center justify-center text-sm text-muted-foreground tabular-nums"
              >
                {format(new Date(2000, 0, 1, hour), "h a")}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const isToday = isSameDay(day, today);
            const isPastDay = day < today;
            const placed = layoutDay(postsByDay.get(dayId(day)) ?? []);
            const weekday = day.getDay();
            const slotsToday = queueSlots.filter((slot) => slot.weekday === weekday);

            return (
              <div key={dayId(day)} className="relative">
                {Array.from({ length: SLOTS_PER_DAY }).map((_, index) => {
                  const slotEnd = (index + 1) * SLOT_MINUTES;
                  const disabled = isPastDay || (isToday && slotEnd <= nowMinutes);
                  return (
                    <Slot
                      key={index}
                      day={day}
                      index={index}
                      disabled={disabled}
                      onCreate={create}
                    />
                  );
                })}

                {slotsToday.map((slot) => {
                  const [h, m] = slot.time.split(":").map(Number);
                  const minutes = h * 60 + m;
                  if (isPastDay || (isToday && minutes <= nowMinutes)) return null;
                  const taken = placed.some(
                    ({ placed: p }) =>
                      Math.abs(p.local.getHours() * 60 + p.local.getMinutes() - minutes) < 2,
                  );
                  if (taken) return null;
                  return (
                    <div
                      key={slot.time}
                      style={{ top: slotTop(minutes) + 8, height: SLOT_HEIGHT - 16 }}
                      className="pointer-events-none absolute inset-x-1.5 flex items-center rounded-md border border-dashed border-primary/40 px-2 text-xs text-muted-foreground"
                    >
                      <span className="truncate">Queue · {format(new Date(2000, 0, 1, h, m), "h:mm a")}</span>
                    </div>
                  );
                })}

                {placed.map(({ placed: p, top, height, left, width, compact }) => (
                  <div
                    key={p.post.id}
                    className="absolute px-1.5"
                    style={{ top, left, width, height }}
                  >
                    <PostChip
                      post={p.post}
                      at={p.at}
                      timeZone={timeZone}
                      variant={compact ? "month" : "slot"}
                      onOpen={onOpen}
                      className="h-full"
                    />
                  </div>
                ))}

                {isToday ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                    style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
                  >
                    <span className="-ml-1 size-2 rounded-full bg-destructive" />
                    <span className="h-px flex-1 bg-destructive" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
