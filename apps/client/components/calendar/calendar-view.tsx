"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CaretLeft,
  CaretRight,
  NotePencil,
  SidebarSimple,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { PageSection } from "@/components/layout/page-header";
import { ErrorState } from "@/components/shared/states";
import { PostSheet } from "@/components/scheduler/post-sheet";
import { DraftCard, PostChip, PostChipBody } from "./post-chip";
import { MonthGrid, type PlacedPost } from "./month-grid";
import { TimeGrid } from "./time-grid";
import { useApi } from "@/hooks/use-api";
import { postQueryKeys, usePosts } from "@/hooks/use-posts";
import {
  usePostingSlots,
  useSchedulerTimezone,
  useWeekStartsOn,
} from "@/hooks/use-schedule";
import {
  dayId,
  fromUtc,
  parseDayId,
  rangeFor,
  SLOT_MINUTES,
  rangeLabel,
  shift,
  toUtc,
  todayIn,
  visibleDays,
  type CalendarView as View,
} from "@/lib/scheduler/calendar";
import { formatDay, formatDayTime, postDate, zoneLabel, zoneName } from "@/lib/scheduler/dates";
import type { Post, PostStatus } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";

const VIEWS: { value: View | "agenda"; label: string; key: string }[] = [
  { value: "month", label: "Month", key: "m" },
  { value: "week", label: "Week", key: "w" },
  { value: "day", label: "Day", key: "d" },
  { value: "agenda", label: "List", key: "l" },
];

const CALENDAR_STATUSES: PostStatus[] = [
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "PARTIALLY_PUBLISHED",
  "FAILED",
];

interface PendingMove {
  post: Post;
  iso: string;
}

const NARROW_QUERY = "(max-width: 767px)";

/** True below md. The server and first client render assume a wide screen. */
function useIsNarrow() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(NARROW_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  );
}

const UNIT_LABEL: Record<View, string> = { month: "month", week: "week", day: "day" };

export function CalendarView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const api = useApi();
  const timeZone = useSchedulerTimezone();
  const weekStartsOn = useWeekStartsOn();
  const slots = usePostingSlots();

  const isNarrow = useIsNarrow();
  // Phones get one day at a time unless a view was picked.
  const view = (searchParams.get("view") as View | "agenda") || (isNarrow ? "day" : "week");
  const today = todayIn(timeZone);
  const anchor = searchParams.get("date") ? parseDayId(searchParams.get("date")!) : today;
  const showPublished = searchParams.get("published") !== "0";
  const draftsOpen = searchParams.get("drafts") !== "0";

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const gridView: View = view === "agenda" ? "month" : view;
  const days = useMemo(() => {
    if (view === "agenda") {
      return Array.from({ length: 30 }, (_, i) =>
        new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + i),
      );
    }
    return visibleDays(gridView, anchor, weekStartsOn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, gridView, dayId(anchor), weekStartsOn]);
  const range = useMemo(() => rangeFor(days, timeZone), [days, timeZone]);

  const postsQuery = usePosts({
    from: range.from,
    to: range.to,
    status: showPublished
      ? CALENDAR_STATUSES
      : CALENDAR_STATUSES.filter((s) => s !== "PUBLISHED"),
    sort: "scheduled",
    dir: "asc",
    limit: 200,
  });
  const draftsQuery = usePosts(
    { status: ["DRAFT"], sort: "updated", dir: "desc", limit: 50 },
    { enabled: draftsOpen },
  );

  const [pending, setPending] = useState<Record<string, PendingMove>>({});
  const [dragging, setDragging] = useState<Post | null>(null);
  const [openPostId, setOpenPostId] = useState<string | null>(null);

  // Clock for the "now" line, refreshed each minute.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const now = fromUtc(new Date(nowTick), timeZone);

  const postsByDay = useMemo(() => {
    const map = new Map<string, PlacedPost[]>();
    const seen = new Set<string>();
    const place = (post: Post, iso: string) => {
      if (seen.has(post.id)) return;
      seen.add(post.id);
      const local = fromUtc(iso, timeZone);
      const key = dayId(local);
      map.set(key, [...(map.get(key) ?? []), { post, at: iso, local }]);
    };
    for (const move of Object.values(pending)) place(move.post, move.iso);
    for (const post of postsQuery.data?.posts ?? []) place(post, postDate(post));
    for (const list of map.values()) list.sort((a, b) => a.local.getTime() - b.local.getTime());
    return map;
  }, [pending, postsQuery.data, timeZone]);

  const drafts = (draftsQuery.data?.posts ?? []).filter((post) => !pending[post.id]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const move = async (post: Post, target: Date) => {
    const previous = post.scheduledFor;
    const iso = target.toISOString();
    setPending((prev) => ({ ...prev, [post.id]: { post, iso } }));
    try {
      await api(`/api/posts/${post.id}`, {
        method: "PUT",
        json: { scheduledFor: iso, timezone: timeZone },
      });
      await queryClient.invalidateQueries({ queryKey: postQueryKeys.all });
      toast.success(
        `${post.status === "DRAFT" ? "Scheduled" : "Moved"} to ${formatDayTime(iso, timeZone)}`,
        {
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await api(`/api/posts/${post.id}`, {
                  method: "PUT",
                  json: previous
                    ? { scheduledFor: previous, timezone: post.scheduledTimezone ?? timeZone }
                    : { scheduledFor: null },
                });
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                void queryClient.invalidateQueries({ queryKey: postQueryKeys.all });
              }
            },
          },
        },
      );
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPending((prev) => {
        const next = { ...prev };
        delete next[post.id];
        return next;
      });
    }
  };

  const onDragStart = (event: DragStartEvent) => {
    setDragging((event.active.data.current?.post as Post) ?? null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const post = event.active.data.current?.post as Post | undefined;
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!post || !overId) return;

    const current = pending[post.id]?.iso ?? post.scheduledFor;
    const currentLocal = current ? fromUtc(current, timeZone) : null;
    let target: Date;

    if (overId.startsWith("day:")) {
      const day = parseDayId(overId.slice(4));
      // Keep the time of day; drafts land at 9:00.
      const hours = currentLocal ? currentLocal.getHours() : 9;
      const minutes = currentLocal ? currentLocal.getMinutes() : 0;
      target = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
    } else if (overId.startsWith("slot:")) {
      const [date, time] = overId.slice(5).split("T");
      const day = parseDayId(date);
      const [h, m] = time.split(":").map(Number);
      // Slots are an hour long, so keep the minutes the post already had.
      const minutes = m + (currentLocal ? currentLocal.getMinutes() % SLOT_MINUTES : 0);
      target = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, minutes);
    } else {
      return;
    }

    if (currentLocal && currentLocal.getTime() === target.getTime()) return;
    const instant = toUtc(target, timeZone);
    if (instant.getTime() < Date.now() + 60_000) {
      toast.error("That time has passed. Drop it on a later time.");
      return;
    }
    void move(post, instant);
  };

  // Keyboard shortcuts: T today, arrows move, M W D L switch views.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "t") setParams({ date: null });
      else if (event.key === "ArrowLeft")
        setParams({ date: dayId(shift(gridView, anchor, -1)) });
      else if (event.key === "ArrowRight")
        setParams({ date: dayId(shift(gridView, anchor, 1)) });
      else {
        const match = VIEWS.find((v) => v.key === key);
        if (match) setParams({ view: match.value });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchor, gridView, setParams]);

  const label =
    view === "agenda"
      ? `${format(days[0], "MMM d")} to ${format(days[days.length - 1], "MMM d, yyyy")}`
      : rangeLabel(gridView, days, anchor);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="mr-auto flex min-w-0 flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setParams({ date: null })}>
              Today
            </Button>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Previous ${UNIT_LABEL[gridView]}`}
                onClick={() => setParams({ date: dayId(shift(gridView, anchor, -1)) })}
              >
                <CaretLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Next ${UNIT_LABEL[gridView]}`}
                onClick={() => setParams({ date: dayId(shift(gridView, anchor, 1)) })}
              >
                <CaretRight />
              </Button>
            </div>
            <div className="flex min-w-0 items-baseline gap-1.5">
              <h2 className="truncate text-base font-semibold tabular-nums">{label}</h2>
              <Link
                href="/settings?tab=scheduling"
                title={`Times in ${zoneName(timeZone)}. Change in Settings.`}
                className="shrink-0 rounded-md px-1 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {zoneLabel(timeZone)}
              </Link>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label className="flex h-8 items-center gap-2 text-sm text-muted-foreground">
              <Switch
                size="sm"
                checked={showPublished}
                onCheckedChange={(checked) => setParams({ published: checked ? null : "0" })}
              />
              Published
            </label>

            <Tabs
              value={view}
              onValueChange={(value) => setParams({ view: value as string })}
              className="w-full sm:w-auto"
            >
              <TabsList size="sm" className="w-full sm:w-fit">
                {VIEWS.map((v) => (
                  <TabsTrigger key={v.value} value={v.value}>
                    {v.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <Toggle
              variant="outline"
              size="sm"
              pressed={draftsOpen}
              onPressedChange={(pressed) => setParams({ drafts: pressed ? null : "0" })}
              className="hidden xl:inline-flex"
            >
              <SidebarSimple />
              Drafts
              {draftsQuery.data?.pagination.total ? (
                <span className="text-muted-foreground tabular-nums">
                  {draftsQuery.data.pagination.total}
                </span>
              ) : null}
            </Toggle>
          </div>
        </div>

        <div className={cn("grid grid-cols-1 gap-4", draftsOpen && "xl:grid-cols-[minmax(0,1fr)_280px]")}>
          <div className="min-w-0">
            {postsQuery.error ? (
              <ErrorState
                title="Couldn't load the calendar"
                description={postsQuery.error.message}
                onRetry={() => void postsQuery.refetch()}
              />
            ) : postsQuery.isLoading ? (
              <Skeleton className="h-[32rem] w-full rounded-xl" />
            ) : view === "agenda" ? (
              <AgendaList
                days={days}
                postsByDay={postsByDay}
                timeZone={timeZone}
                onOpen={setOpenPostId}
              />
            ) : gridView === "month" ? (
              <MonthGrid
                days={days}
                anchor={anchor}
                today={today}
                postsByDay={postsByDay}
                timeZone={timeZone}
                weekStartsOn={weekStartsOn}
                onOpen={setOpenPostId}
              />
            ) : (
              <TimeGrid
                days={days}
                today={today}
                now={now}
                postsByDay={postsByDay}
                queueSlots={slots.data?.slots ?? []}
                timeZone={timeZone}
                onOpen={setOpenPostId}
              />
            )}
          </div>

          {draftsOpen ? (
            <aside className="hidden xl:block">
              <PageSection
                title="Drafts"
                description="Drag a draft onto a day or time to schedule it."
                actions={
                  <Link
                    href="/scheduler/new"
                    className={buttonVariants({ variant: "ghost", size: "xs" })}
                  >
                    <NotePencil />
                    New
                  </Link>
                }
              >
                <div className="max-h-[calc(100svh-16rem)] space-y-2 overflow-y-auto pr-1">
                  {draftsQuery.isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full rounded-xl" />
                    ))
                  ) : drafts.length ? (
                    drafts.map((post) => (
                      <DraftCard key={post.id} post={post} onOpen={setOpenPostId} />
                    ))
                  ) : (
                    <p className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">
                      No drafts. Posts you save as drafts, or your agent creates without a
                      time, wait here.
                    </p>
                  )}
                </div>
              </PageSection>
            </aside>
          ) : null}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <PostChipBody
            post={dragging}
            timeZone={timeZone}
            at={pending[dragging.id]?.iso ?? dragging.scheduledFor ?? new Date().toISOString()}
            variant="overlay"
          />
        ) : null}
      </DragOverlay>

      <PostSheet postId={openPostId} onOpenChange={(open) => !open && setOpenPostId(null)} />
    </DndContext>
  );
}

function AgendaList({
  days,
  postsByDay,
  timeZone,
  onOpen,
}: {
  days: Date[];
  postsByDay: Map<string, PlacedPost[]>;
  timeZone: string;
  onOpen: (postId: string) => void;
}) {
  const withPosts = days.filter((day) => (postsByDay.get(dayId(day)) ?? []).length);
  if (!withPosts.length) {
    return (
      <div className="rounded-xl bg-muted p-10 text-center text-sm text-muted-foreground">
        Nothing scheduled in the next 30 days.
      </div>
    );
  }
  return (
    <div className="divide-y divide-card rounded-xl bg-muted">
      {withPosts.map((day) => (
        <div key={dayId(day)} className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-[9rem_1fr]">
          <p className="text-sm font-medium">
            {formatDay(toUtc(day, timeZone), timeZone, true)}
          </p>
          <div className="space-y-1.5">
            {(postsByDay.get(dayId(day)) ?? []).map(({ post, at }) => (
              <PostChip
                key={post.id}
                post={post}
                at={at}
                timeZone={timeZone}
                variant="month"
                onOpen={onOpen}
                className="[&>span]:h-8"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
