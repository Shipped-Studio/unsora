"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { format, isSameDay } from "date-fns";
import {
  CaretLeft,
  CaretRight,
  NotePencil,
  SidebarSimple,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/shared/states";
import { accountLabel } from "@/components/scheduler/account-avatar";
import { PostSheet } from "@/components/scheduler/post-sheet";
import { DraftCard, PostChip, PostChipBody } from "./post-chip";
import { MonthGrid, type PlacedPost } from "./month-grid";
import { TimeGrid } from "./time-grid";
import { useApi } from "@/hooks/use-api";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
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

export function CalendarView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const api = useApi();
  const timeZone = useSchedulerTimezone();
  const weekStartsOn = useWeekStartsOn();
  const { data: accounts } = useConnectedAccounts();
  const slots = usePostingSlots();

  const view = (searchParams.get("view") as View | "agenda") || "week";
  const today = todayIn(timeZone);
  const anchor = searchParams.get("date") ? parseDayId(searchParams.get("date")!) : today;
  const accountId = searchParams.get("account") ?? "";
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
    accountId: accountId || undefined,
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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setParams({ date: null })}
            disabled={isSameDay(anchor, today) && view !== "month"}
          >
            Today
          </Button>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous"
              onClick={() => setParams({ date: dayId(shift(gridView, anchor, -1)) })}
            >
              <CaretLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next"
              onClick={() => setParams({ date: dayId(shift(gridView, anchor, 1)) })}
            >
              <CaretRight />
            </Button>
          </div>
          <h2 className="text-lg font-semibold tabular-nums">{label}</h2>
          <Link
            href="/settings?tab=scheduling"
            title={`Times in ${zoneName(timeZone)}. Change in Settings.`}
            className="mr-auto rounded-md px-1.5 py-0.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {zoneLabel(timeZone)}
          </Link>

          <Select
            value={accountId || "all"}
            onValueChange={(value) => setParams({ account: value === "all" ? null : (value as string) })}
          >
            <SelectTrigger className="w-48">
              <SelectValue>
                {(value: string) => {
                  const account = accounts?.find((a) => a.id === value);
                  return account ? accountLabel(account) : "All accounts";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {(accounts ?? []).map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {accountLabel(account)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              size="sm"
              checked={showPublished}
              onCheckedChange={(checked) => setParams({ published: checked ? null : "0" })}
            />
            Published
          </label>

          <Tabs value={view} onValueChange={(value) => setParams({ view: value as string })}>
            <TabsList>
              {VIEWS.map((v) => (
                <TabsTrigger key={v.value} value={v.value}>
                  {v.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Button
            variant="outline"
            aria-pressed={draftsOpen}
            onClick={() => setParams({ drafts: draftsOpen ? "0" : null })}
            className={cn(
              "hidden xl:inline-flex",
              draftsOpen && "border-transparent bg-accent text-accent-foreground hover:bg-accent",
            )}
          >
            <SidebarSimple />
            Drafts
            {draftsQuery.data?.pagination.total ? (
              <span className="text-muted-foreground tabular-nums">
                {draftsQuery.data.pagination.total}
              </span>
            ) : null}
          </Button>
        </div>


        <div className={cn("grid gap-4", draftsOpen && "xl:grid-cols-[minmax(0,1fr)_280px]")}>
          <div className="min-w-0">
            {postsQuery.error ? (
              <ErrorState
                title="Couldn't load the calendar"
                description={postsQuery.error.message}
                onRetry={() => void postsQuery.refetch()}
              />
            ) : postsQuery.isLoading ? (
              <Skeleton className="h-[32rem] w-full rounded-lg" />
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
            <aside className="hidden space-y-3 xl:block">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Drafts</h3>
                <Link
                  href="/scheduler/new"
                  className={buttonVariants({ variant: "ghost", size: "xs" })}
                >
                  <NotePencil />
                  New
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">
                Drag a draft onto a day or time to schedule it.
              </p>
              <div className="max-h-[calc(100svh-16rem)] space-y-2 overflow-y-auto pr-1">
                {draftsQuery.isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
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
        <div key={dayId(day)} className="grid gap-2 p-3 sm:grid-cols-[9rem_1fr]">
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
