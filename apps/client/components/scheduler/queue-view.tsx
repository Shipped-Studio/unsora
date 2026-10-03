"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Plus, Queue, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { AccountStack } from "@/components/scheduler/account-avatar";
import { PostSheet } from "@/components/scheduler/post-sheet";
import { PostStatusBadge } from "@/components/scheduler/post-status-badge";
import { PostThumb } from "@/components/scheduler/post-thumb";
import { TimezoneCombobox } from "@/components/scheduler/timezone-combobox";
import { usePosts } from "@/hooks/use-posts";
import {
  useNextSlots,
  usePostingSlots,
  useSavePostingSlots,
  useSchedulerTimezone,
  useWeekStartsOn,
  type PostingSlot,
} from "@/hooks/use-schedule";
import { dayKey, formatDay, formatTime } from "@/lib/scheduler/dates";
import type { Post } from "@/lib/scheduler/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Row =
  | { kind: "post"; at: string; post: Post }
  | { kind: "slot"; at: string };

function Upcoming({ timeZone, onOpen }: { timeZone: string; onOpen: (id: string) => void }) {
  const [from] = useState(() => new Date().toISOString());
  const posts = usePosts({
    status: ["SCHEDULED", "PUBLISHING"],
    from,
    sort: "scheduled",
    dir: "asc",
    limit: 100,
  });
  const open = useNextSlots({ timezone: timeZone, count: 8 });

  const groups = useMemo(() => {
    const rows: Row[] = [
      ...(posts.data?.posts ?? []).map((post) => ({
        kind: "post" as const,
        at: post.scheduledFor!,
        post,
      })),
      ...(open.data?.slots ?? []).map((at) => ({ kind: "slot" as const, at })),
    ].sort((a, b) => a.at.localeCompare(b.at));
    const map = new Map<string, Row[]>();
    for (const row of rows) {
      const key = dayKey(row.at, timeZone);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return [...map.entries()];
  }, [open.data, posts.data, timeZone]);

  if (posts.error) {
    return (
      <ErrorState
        title="Couldn't load your queue"
        description={posts.error.message}
        onRetry={() => void posts.refetch()}
      />
    );
  }
  if (posts.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (!groups.length) {
    return (
      <EmptyState
        icon={Queue}
        title="Your queue is empty"
        description="Schedule a post, or add posting times so Add to queue knows when to post."
        action={{ label: "New post", href: "/scheduler/new" }}
      />
    );
  }

  return (
    <div className="divide-y divide-card rounded-xl bg-muted">
      {groups.map(([key, rows]) => (
        <section
          key={key}
          aria-label={formatDay(rows[0].at, timeZone, true)}
          className="grid grid-cols-1 gap-x-4 gap-y-1 p-2 sm:grid-cols-[10rem_minmax(0,1fr)]"
        >
          <h3
            className="px-2 pt-1 text-sm font-medium sm:pt-2.5"
            title={formatDay(rows[0].at, timeZone, true)}
          >
            {formatDay(rows[0].at, timeZone)}
          </h3>
          <ul className="space-y-1">
            {rows.map((row) =>
              row.kind === "post" ? (
                <li key={row.post.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(row.post.id)}
                    className="flex min-h-10 w-full items-center gap-3 rounded-lg px-2 py-1 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="w-16 shrink-0 text-sm font-medium tabular-nums">
                      {formatTime(row.at, timeZone)}
                    </span>
                    <PostThumb post={row.post} className="size-8 bg-card" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {row.post.mainCaption.trim() || "No caption"}
                    </span>
                    <span className="hidden sm:block">
                      <AccountStack accounts={row.post.postAccounts.map((leg) => leg.account)} />
                    </span>
                    <PostStatusBadge status={row.post.status} className="hidden md:inline-flex" />
                  </button>
                </li>
              ) : (
                <li
                  key={`slot-${row.at}`}
                  className="flex min-h-10 items-center gap-3 rounded-lg border border-dashed border-input py-1 pr-1 pl-2"
                >
                  <span className="w-16 shrink-0 text-sm tabular-nums text-muted-foreground">
                    {formatTime(row.at, timeZone)}
                  </span>
                  <span className="flex-1 text-sm text-muted-foreground">Open</span>
                  <Link
                    href={`/scheduler/new?date=${encodeURIComponent(row.at)}`}
                    aria-label={`Fill the open slot at ${formatTime(row.at, timeZone)}`}
                    className={buttonVariants({ variant: "ghost", size: "xs" })}
                  >
                    <Plus />
                    Fill
                  </Link>
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PostingTimes({ timeZone }: { timeZone: string }) {
  const weekStartsOn = useWeekStartsOn();
  const slotsQuery = usePostingSlots();
  const save = useSavePostingSlots();
  const [draft, setDraft] = useState<PostingSlot[] | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  const [newTime, setNewTime] = useState("09:00");
  const [newDays, setNewDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const slots = draft ?? slotsQuery.data?.slots ?? [];
  const activeZone = zone ?? timeZone;
  const dirty = draft !== null || zone !== null;
  const order = weekStartsOn === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];

  const edit = (next: PostingSlot[]) =>
    setDraft(
      [...new Map(next.map((s) => [`${s.weekday}-${s.time}`, s])).values()].sort(
        (a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time),
      ),
    );

  if (slotsQuery.isLoading) return <Skeleton className="h-80 w-full rounded-xl" />;
  if (slotsQuery.error) {
    return (
      <ErrorState
        title="Couldn't load posting times"
        description={slotsQuery.error.message}
        onRetry={() => void slotsQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-4 rounded-xl bg-muted p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Posting times</h3>
        <p className="text-sm text-muted-foreground">
          Add to queue puts a post in the next open time. Agents use these too when they
          don&apos;t pick a time.
        </p>
      </div>

      <TimezoneCombobox value={activeZone} onChange={setZone} className="w-full" />

      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-xs font-medium text-muted-foreground">Add a time</p>
        <div className="flex items-center gap-2">
          <Input
            type="time"
            step={300}
            value={newTime}
            onChange={(event) => setNewTime(event.target.value)}
            className="min-w-36 flex-1"
            aria-label="Time"
          />
          <Button
            variant="outline"
            disabled={!newTime || !newDays.length}
            onClick={() =>
              edit([...slots, ...newDays.map((weekday) => ({ weekday, time: newTime }))])
            }
          >
            <Plus />
            Add
          </Button>
        </div>
        <ToggleGroup
          multiple
          variant="outline"
          size="sm"
          spacing={1}
          aria-label="Days"
          value={newDays.map(String)}
          onValueChange={(value) => setNewDays(value.map(Number))}
          className="grid w-full grid-cols-7 gap-1"
        >
          {order.map((weekday) => (
            <ToggleGroupItem
              key={weekday}
              value={String(weekday)}
              className="min-w-0 px-0 text-xs aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90 data-pressed:bg-primary"
            >
              {WEEKDAYS[weekday]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <ul className="space-y-1 border-t border-border pt-4">
        {order.map((weekday) => {
          const times = slots.filter((s) => s.weekday === weekday);
          return (
            <li key={weekday} className="flex items-start gap-3">
              <span className="h-8 w-10 shrink-0 text-sm leading-8 text-muted-foreground">
                {WEEKDAYS[weekday]}
              </span>
              <div className="flex min-h-8 flex-1 flex-wrap items-center gap-1.5">
                {times.length ? (
                  times.map((slot) => (
                    <span
                      key={slot.time}
                      className="inline-flex h-7 items-center gap-0.5 rounded-full bg-card pr-0.5 pl-2.5 text-xs tabular-nums"
                    >
                      {format(new Date(`2000-01-01T${slot.time}:00`), "h:mm a")}
                      <button
                        type="button"
                        aria-label={`Remove ${WEEKDAYS[weekday]} ${slot.time}`}
                        onClick={() =>
                          edit(slots.filter((s) => !(s.weekday === weekday && s.time === slot.time)))
                        }
                        className="relative flex size-6 items-center justify-center rounded-full text-muted-foreground outline-none after:absolute after:-inset-1 hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No times</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex justify-end gap-2">
        {dirty ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(null);
              setZone(null);
            }}
          >
            Discard
          </Button>
        ) : null}
        <Button
          size="sm"
          disabled={!dirty || save.isPending}
          onClick={() =>
            save.mutate(
              { slots, timezone: zone ?? undefined },
              {
                onSuccess: () => {
                  toast.success("Posting times saved");
                  setDraft(null);
                  setZone(null);
                },
                onError: (error) => toast.error(error.message),
              },
            )
          }
        >
          Save times
        </Button>
      </div>
    </div>
  );
}

export function QueueView() {
  const timeZone = useSchedulerTimezone();
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 lg:self-start">
        <Upcoming timeZone={timeZone} onOpen={setOpenPostId} />
      </div>
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <PostingTimes timeZone={timeZone} />
      </aside>
      <PostSheet postId={openPostId} onOpenChange={(open) => !open && setOpenPostId(null)} />
    </div>
  );
}
