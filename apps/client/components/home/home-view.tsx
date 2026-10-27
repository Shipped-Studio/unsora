"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDots,
  CaretUp,
  CheckCircle,
  Circle,
  NotePencil,
  Plus,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/shared/states";
import { AgentMediaList, AgentMediaRow } from "@/components/home/agent-media-row";
import { AccountStack } from "@/components/scheduler/account-avatar";
import { PostSheet } from "@/components/scheduler/post-sheet";
import { PostStatusBadge } from "@/components/scheduler/post-status-badge";
import { PostThumb } from "@/components/scheduler/post-thumb";
import { readableError } from "@/components/scheduler/readable-error";
import { useApiKeys } from "@/components/api-keys/use-api-keys";
import { useAnalyticsSummary } from "@/hooks/use-analytics";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { libraryKindLabel, useLibraryPage } from "@/hooks/use-library";
import { usePostCounts, usePosts } from "@/hooks/use-posts";
import { usePostingSlots, useSchedulerTimezone, type PostingSlot } from "@/hooks/use-schedule";
import { dayKey, formatRelative, formatTime, inZone, postDate } from "@/lib/scheduler/dates";
import type { Post, PostStatus } from "@/lib/scheduler/types";
import { fromZonedTime } from "@/lib/timezone";
import { cn } from "@/lib/utils";

/** Every status that has a date; drafts live in their own list. */
const DATED: PostStatus[] = ["SCHEDULED", "PUBLISHING", "PUBLISHED", "PARTIALLY_PUBLISHED", "FAILED"];
/** The API returns at most this many posts per request. */
const PAGE_LIMIT = 200;
const START_PAST_DAYS = 7;
const START_FUTURE_DAYS = 7;
const STEP_DAYS = 14;
const MAX_FUTURE_DAYS = 365;
/** Today and the days right after it always get their own row. */
const OWN_ROW_DAYS = 7;
/** Hour (in the scheduler's zone) a new post from an empty day starts at. */
const NEW_POST_HOUR = 10;

const ROW_FOCUS = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
/** Side-column blocks: plain sections split by a hairline, not cards. */
const SIDE = "border-t pt-5 first:border-t-0 first:pt-0";
/** Dashed "nothing here, add a post" slot. */
const EMPTY_SLOT =
  "group flex items-center gap-2 rounded-xl border border-dashed px-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-brand-subtle hover:text-brand-subtle-foreground";

const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const monthFormat = new Intl.DateTimeFormat(undefined, { month: "short" });
const shortDateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const yearDateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const monthYearFormat = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

interface Day {
  key: string;
  /** Naive local midnight in the scheduler's zone. */
  date: Date;
  offset: number;
}

/** A day with posts (or today), or a run of empty days shown as one row. */
type Row = { kind: "day"; day: Day; posts: Post[] } | { kind: "gap"; from: Day; to: Day };

/** Naive local midnights from `-past` to `future` days around today. */
function buildDays(today: Date, past: number, future: number): Day[] {
  const days: Day[] = [];
  for (let offset = -past; offset <= future; offset++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    days.push({ key, date, offset });
  }
  return days;
}

/** Days with posts stay; empty stretches fold into one row. Today always shows. */
function buildRows(days: Day[], byDay: Map<string, Post[]>): Row[] {
  const rows: Row[] = [];
  for (const day of days) {
    const posts = byDay.get(day.key) ?? [];
    if (posts.length || (day.offset >= 0 && day.offset < OWN_ROW_DAYS)) {
      rows.push({ kind: "day", day, posts });
      continue;
    }
    const last = rows[rows.length - 1];
    // Past and future runs stay separate so "Add post" only covers future days.
    if (last?.kind === "gap" && (last.to.offset < 0) === (day.offset < 0)) last.to = day;
    else rows.push({ kind: "gap", from: day, to: day });
  }
  return rows;
}

function newPostHref(day: Day, timeZone: string) {
  const naive = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate(), NEW_POST_HOUR);
  // Today after 10 AM: suggest the next full hour instead.
  if (day.offset === 0) {
    const now = inZone(new Date(), timeZone);
    if (now.getHours() >= NEW_POST_HOUR) naive.setHours(now.getHours() + 1, 0, 0, 0);
  }
  return `/scheduler/new?date=${encodeURIComponent(fromZonedTime(naive, timeZone).toISOString())}`;
}

const slotTimeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/**
 * Posting times still free on a day: the weekday's slots, minus any a post
 * already sits on and, today, any that have passed. Same rule as the calendar.
 */
function openSlots(day: Day, posts: Post[], slots: PostingSlot[], timeZone: string) {
  if (day.offset < 0) return [];
  const now = inZone(new Date(), timeZone);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const taken = posts.map((post) => {
    const local = inZone(postDate(post), timeZone);
    return local.getHours() * 60 + local.getMinutes();
  });
  return slots
    .filter((slot) => slot.weekday === day.date.getDay())
    .map((slot) => {
      const [h, m] = slot.time.split(":").map(Number);
      return { minutes: h * 60 + m, h, m };
    })
    .filter(({ minutes }) => !(day.offset === 0 && minutes <= nowMinutes))
    .filter(({ minutes }) => !taken.some((t) => Math.abs(t - minutes) < 2))
    .sort((a, b) => a.minutes - b.minutes)
    .map(({ h, m }) => {
      const naive = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate(), h, m);
      return {
        label: slotTimeFormat.format(naive),
        href: `/scheduler/new?date=${encodeURIComponent(fromZonedTime(naive, timeZone).toISOString())}`,
      };
    });
}

/** A queue time with nothing on it yet. */
function OpenSlotLink({ slot }: { slot: { label: string; href: string } }) {
  return (
    <Link href={slot.href} className={cn(EMPTY_SLOT, "py-2.5", ROW_FOCUS)}>
      <span className="font-medium text-foreground tabular-nums group-hover:text-inherit">{slot.label}</span>
      <span>Open queue slot</span>
      <AddPostHint />
    </Link>
  );
}

function useToday(timeZone: string) {
  return useMemo(() => {
    const now = inZone(new Date(), timeZone);
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, [timeZone]);
}

/* ── Pieces ───────────────────────────────────────────────────────────── */

function DateBadge({ day }: { day: Day }) {
  const isToday = day.offset === 0;
  const past = day.offset < 0;
  return (
    <div className="flex w-14 flex-col items-center text-center">
      <span
        className={cn(
          "text-2xs font-semibold tracking-wider uppercase",
          isToday ? "text-primary" : "text-muted-foreground",
        )}
      >
        {isToday ? "Today" : weekdayFormat.format(day.date)}
      </span>
      <span
        className={cn(
          "mt-1 flex size-10 items-center justify-center rounded-full font-display text-lg font-bold tabular-nums",
          isToday ? "bg-primary text-primary-foreground shadow-sm" : "bg-card text-foreground ring-1 ring-border",
          past && "text-muted-foreground",
        )}
      >
        {day.date.getDate()}
      </span>
      <span className="mt-1 text-2xs text-muted-foreground">{monthFormat.format(day.date)}</span>
    </div>
  );
}

function PostCard({ post, timeZone, onOpen }: { post: Post; timeZone: string; onOpen: (id: string) => void }) {
  const failed = post.status === "FAILED" || post.status === "PARTIALLY_PUBLISHED";
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(post.id)}
        className={cn(
          "flex w-full min-w-0 items-center gap-3.5 rounded-xl border border-transparent p-2 text-left transition-colors hover:border-border hover:bg-muted/60",
          ROW_FOCUS,
        )}
      >
        <PostThumb post={post} className="size-14 rounded-lg" />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold tabular-nums">{formatTime(postDate(post), timeZone)}</span>
            <PostStatusBadge status={post.status} />
          </span>
          <span className="line-clamp-1 block text-sm text-muted-foreground">
            {post.mainCaption.trim() || "No caption"}
          </span>
          {failed && post.error ? (
            <span className="line-clamp-1 block text-xs text-destructive" title={post.error}>
              {readableError(post.error)}
            </span>
          ) : null}
        </span>
        <span className="hidden shrink-0 sm:block">
          <AccountStack accounts={post.postAccounts.map((leg) => leg.account)} />
        </span>
      </button>
    </li>
  );
}

/** Busy days show this many posts, then a "Show N more" button. */
const DAY_PREVIEW = 3;

function DayPosts({
  day,
  posts,
  open,
  timeZone,
  onOpen,
}: {
  day: Day;
  posts: Post[];
  open: { label: string; href: string }[];
  timeZone: string;
  onOpen: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? posts : posts.slice(0, DAY_PREVIEW);
  const hidden = posts.length - shown.length;
  return (
    <ul className="space-y-0.5">
      {shown.map((post) => (
        <PostCard key={post.id} post={post} timeZone={timeZone} onOpen={onOpen} />
      ))}
      <li className="flex items-center gap-1 pl-1">
        {hidden > 0 ? (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setExpanded(true)}>
            Show {hidden} more
          </Button>
        ) : null}
        {day.offset >= 0 ? (
          <Link
            href={open[0]?.href ?? newPostHref(day, timeZone)}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
          >
            <Plus data-icon="inline-start" />
            {open.length ? `Add post at ${open[0].label}` : "Add post"}
          </Link>
        ) : null}
      </li>
    </ul>
  );
}

/** One row standing in for a run of empty days. */
function GapRow({ from, to, timeZone }: { from: Day; to: Day; timeZone: string }) {
  const single = from.key === to.key;
  // Spell out the year once a range runs into another one.
  const fmt = from.date.getFullYear() === to.date.getFullYear() ? shortDateFormat : yearDateFormat;
  const label = single
    ? `${weekdayFormat.format(from.date)}, ${shortDateFormat.format(from.date)}`
    : `${fmt.format(from.date)} – ${fmt.format(to.date)}`;

  return (
    <li className="relative flex items-center gap-4 pb-5">
      <div className="flex w-14 justify-center">
        <span className="size-2 rounded-full bg-border ring-4 ring-card" />
      </div>
      {from.offset < 0 ? (
        <p className="flex-1 py-2 text-sm text-muted-foreground">
          {label} · <span className="text-muted-foreground/70">Nothing posted</span>
        </p>
      ) : (
        <Link href={newPostHref(from, timeZone)} className={cn(EMPTY_SLOT, "flex-1 py-2.5", ROW_FOCUS)}>
          <span>{label} · Nothing planned</span>
          <AddPostHint />
        </Link>
      )}
    </li>
  );
}

function AddPostHint() {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1 font-medium whitespace-nowrap text-primary">
      <Plus className="size-3.5" weight="bold" />
      Add post
    </span>
  );
}

/** Failed posts and accounts that need care, as one banner. */
function AttentionNotice() {
  const accounts = useConnectedAccounts();
  const counts = usePostCounts();
  const failed = counts.data?.counts ? counts.data.counts.FAILED + counts.data.counts.PARTIALLY_PUBLISHED : 0;
  const broken = (accounts.data ?? []).filter((a) => a.status === "reconnect").length;
  const expiring = (accounts.data ?? []).filter((a) => a.status === "expiring").length;
  if (!failed && !broken && !expiring) return null;

  const danger = failed > 0 || broken > 0;
  const parts = [
    failed ? `${failed} post${failed === 1 ? "" : "s"} didn't publish` : null,
    broken ? `${broken} account${broken === 1 ? " needs" : "s need"} reconnecting` : null,
    expiring ? `${expiring} account${expiring === 1 ? " expires" : "s expire"} soon` : null,
  ].filter(Boolean);

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-xl px-4 py-3 sm:flex-row sm:items-center",
        danger ? "bg-destructive-subtle" : "bg-warning-subtle",
      )}
    >
      <p className={cn("flex flex-1 items-center gap-2 text-sm font-medium", danger ? "text-destructive" : "text-warning")}>
        <WarningCircle className="size-4.5 shrink-0" weight="fill" />
        {parts.join(" · ")}
      </p>
      <div className="flex shrink-0 gap-2">
        {failed ? (
          <Link href="/scheduler/posts?status=failed" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Review posts
          </Link>
        ) : null}
        {broken || expiring ? (
          <Link href="/scheduler/accounts" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Go to accounts
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** Three steps for new users, plus the optional agent one; gone once the three are done. */
function GetStarted() {
  const accounts = useConnectedAccounts();
  const slots = usePostingSlots();
  const counts = usePostCounts();
  const keys = useApiKeys();
  if (accounts.isLoading || slots.isLoading || counts.isLoading) return null;

  const steps = [
    { done: (accounts.data?.length ?? 0) > 0, label: "Connect a social account", href: "/scheduler/accounts" },
    { done: (slots.data?.slots.length ?? 0) > 0, label: "Pick your posting times", href: "/scheduler/queue" },
    { done: (counts.data?.total ?? 0) > 0, label: "Schedule your first post", href: "/scheduler/new" },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const agentDone = (keys.data?.length ?? 0) > 0;

  return (
    <section className={SIDE} data-tour="setup">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold">Get started</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {done} of {steps.length}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.max(4, (done / steps.length) * 100)}%` }}
        />
      </div>
      <ol className="mt-3 -mx-2 space-y-0.5">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className={cn("flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted", ROW_FOCUS)}
            >
              {step.done ? (
                <CheckCircle weight="fill" className="size-5 shrink-0 text-success" />
              ) : (
                <Circle className="size-5 shrink-0 text-muted-foreground" />
              )}
              <span className="sr-only">{step.done ? "Done:" : "To do:"}</span>
              <span className={cn("flex-1", step.done && "text-muted-foreground line-through")}>{step.label}</span>
              {!step.done ? <ArrowRight className="size-4 text-muted-foreground" /> : null}
            </Link>
          </li>
        ))}
        {agentDone ? null : (
          <li>
            <Link
              href="/connect-agent"
              className={cn("flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", ROW_FOCUS)}
            >
              <Circle className="size-5 shrink-0 opacity-50" weight="duotone" />
              <span className="flex-1">Connect your AI agent</span>
              <span className="text-2xs font-medium tracking-wide uppercase">Optional</span>
            </Link>
          </li>
        )}
      </ol>
    </section>
  );
}

/**
 * The next post with a countdown, and how busy the coming week is: one bar
 * per day, today first, so gaps stand out.
 */
function NextUp({ onOpenPost }: { onOpenPost: (id: string) => void }) {
  const timeZone = useSchedulerTimezone();
  const [now] = useState(() => new Date());
  const today = useToday(timeZone);
  const days = useMemo(() => buildDays(today, 0, 6), [today]);
  const slots = usePostingSlots().data?.slots ?? [];
  const posts = usePosts({
    status: ["SCHEDULED", "PUBLISHING"],
    from: now.toISOString(),
    to: fromZonedTime(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7), timeZone).toISOString(),
    sort: "scheduled",
    dir: "asc",
    limit: PAGE_LIMIT,
  });

  if (posts.isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  const list = posts.data?.posts ?? [];
  const next = list[0];
  const postsByDay = days.map((day) => list.filter((p) => dayKey(postDate(p), timeZone) === day.key));
  const perDay = postsByDay.map((dayPosts) => dayPosts.length);
  const openPerDay = days.map((day, i) => openSlots(day, postsByDay[i], slots, timeZone).length);
  const openCount = openPerDay.reduce((sum, n) => sum + n, 0);
  const peak = Math.max(1, ...perDay);

  return (
    <section className={cn(SIDE, "space-y-4")}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">This week</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {list.length} scheduled
        </span>
      </div>
      {next ? (
        <button
          type="button"
          onClick={() => onOpenPost(next.id)}
          className={cn("-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted", ROW_FOCUS)}
        >
          <PostThumb post={next} className="size-11 rounded-lg" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">Next post</span>
            <span className="block text-sm font-semibold">{formatRelative(postDate(next))}</span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground" />
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing scheduled for the next 7 days.</p>
      )}
      {openCount ? (
        <Link
          href="/scheduler/queue"
          className={cn("-mx-2 flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted", ROW_FOCUS)}
        >
          <span className="size-2 rounded-full border border-dashed border-foreground/50" aria-hidden />
          <span className="flex-1">
            {openCount} open queue slot{openCount === 1 ? "" : "s"} this week
          </span>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>
      ) : null}

      <div>
        <div className="flex h-14 items-end gap-1.5" aria-hidden>
          {perDay.map((count, i) => (
            <div key={days[i].key} className="flex h-full flex-1 items-end">
              {/* Posts as solid bars; a day with only open queue slots as a dashed outline. */}
              <div
                className={cn(
                  "w-full rounded-[3px]",
                  count
                    ? i === 0
                      ? "bg-primary"
                      : "bg-primary/35"
                    : openPerDay[i]
                      ? "h-[30%] border border-dashed border-foreground/30"
                      : "h-1 bg-border",
                )}
                style={count ? { height: `${Math.max(14, (count / peak) * 100)}%` } : undefined}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5 text-center text-2xs text-muted-foreground">
          {days.map((day, i) => (
            <span key={day.key} className={cn("flex-1", i === 0 && "font-semibold text-foreground")}>
              {i === 0 ? "Today" : weekdayFormat.format(day.date).slice(0, 2)}
            </span>
          ))}
        </div>
        <p className="sr-only">
          Posts scheduled per day: {days.map((d, i) => `${weekdayFormat.format(d.date)} ${perDay[i]}`).join(", ")}.
          Open queue slots: {openCount}.
        </p>
      </div>
    </section>
  );
}

const compact = new Intl.NumberFormat(undefined, { notation: "compact" });

/** Post counts and last week's views at a glance, each linking to its list. */
function Overview() {
  const counts = usePostCounts();
  const stats = useAnalyticsSummary(7);
  const c = counts.data?.counts;
  const tiles = [
    { label: "Scheduled", value: c ? c.SCHEDULED + c.PUBLISHING : null, href: "/scheduler/posts?status=scheduled" },
    { label: "Published", value: c ? c.PUBLISHED + c.PARTIALLY_PUBLISHED : null, href: "/scheduler/posts?status=published" },
    { label: "Views, 7d", value: stats.data?.totals.views ?? (stats.isLoading ? null : 0), href: "/scheduler/analytics?days=7" },
  ];
  return (
    <section className={SIDE}>
      <h2 className="text-sm font-semibold">At a glance</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className={cn("rounded-lg bg-muted px-3 py-2.5 transition-colors hover:bg-accent", ROW_FOCUS)}
          >
            {t.value === null ? (
              <Skeleton className="h-7 w-8" />
            ) : (
              <p className="font-display text-xl font-bold tabular-nums">{compact.format(t.value)}</p>
            )}
            <p className="truncate text-xs text-muted-foreground">{t.label}</p>
          </Link>
        ))}
      </div>
      {c?.DRAFT ? (
        <Link
          href="/scheduler/posts?status=drafts"
          className={cn("-mx-2 mt-3 flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted", ROW_FOCUS)}
        >
          <NotePencil className="size-4 text-muted-foreground" />
          <span className="flex-1">
            {c.DRAFT} draft{c.DRAFT === 1 ? "" : "s"} waiting for a time
          </span>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>
      ) : null}
    </section>
  );
}

/** Media Claude, ChatGPT or Cursor made through Unsora, ready to schedule. Hidden until there is some. */
function FromAgents() {
  const fromAgents = useLibraryPage({ source: "api", limit: 4 });
  const items = fromAgents.data?.items ?? [];
  if (!items.length) return null;

  return (
    <section className={SIDE}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Ready to schedule</h2>
        <Link
          href="/files?source=api"
          className={cn(buttonVariants({ variant: "ghost", size: "xs" }), "-mr-2 text-muted-foreground")}
        >
          Library
          <ArrowRight data-icon="inline-end" />
        </Link>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">Made by your AI agents</p>
      <div className="mt-3">
        <AgentMediaList>
          {items.map((item) => (
            <AgentMediaRow
              key={item.id}
              item={item}
              meta={`${libraryKindLabel(item.kind)} · ${formatRelative(item.createdAt)}`}
            />
          ))}
        </AgentMediaList>
      </div>
    </section>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-5 pt-12">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-16 w-14 rounded-xl" />
          <Skeleton className="h-20 flex-1 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

/* ── Timeline ─────────────────────────────────────────────────────────── */

/**
 * One vertical, scrolling list: a week back, then forward as far as you
 * scroll. Days with posts show their date; empty stretches fold into a
 * single row with "Add post".
 */
function Timeline({ onOpenPost }: { onOpenPost: (id: string) => void }) {
  const timeZone = useSchedulerTimezone();
  const [past, setPast] = useState(START_PAST_DAYS);
  const [future, setFuture] = useState(START_FUTURE_DAYS);
  const todayRef = useRef<HTMLLIElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrolledToToday = useRef(false);
  // Set by the user scrolling, used up by each load. Empty days fold into one
  // row, so loading more doesn't always make the page taller: without this
  // the still-visible sentinel would load again after every fetch.
  const scrolledSinceLoad = useRef(false);

  const today = useToday(timeZone);
  const days = useMemo(() => buildDays(today, past, future), [today, past, future]);

  // Query range in real instants: the zone's midnight at each end.
  const from = fromZonedTime(days[0].date, timeZone).toISOString();
  const to = fromZonedTime(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + future + 1),
    timeZone,
  ).toISOString();

  const posts = usePosts({ status: DATED, from, to, sort: "scheduled", dir: "asc", limit: PAGE_LIMIT });
  const slots = usePostingSlots().data?.slots ?? [];

  const rows = useMemo(() => {
    const byDay = new Map<string, Post[]>();
    for (const post of posts.data?.posts ?? []) {
      const key = dayKey(postDate(post), timeZone);
      byDay.set(key, [...(byDay.get(key) ?? []), post]);
    }
    for (const list of byDay.values()) {
      list.sort((a, b) => new Date(postDate(a)).getTime() - new Date(postDate(b)).getTime());
    }
    // Flag the first row of each month for its heading.
    const built = buildRows(days, byDay);
    const monthOf = (row: Row) => {
      const d = (row.kind === "day" ? row.day : row.from).date;
      return d.getFullYear() * 12 + d.getMonth();
    };
    return built.map((row, i) => ({
      row,
      first: row.kind === "day" ? row.day : row.from,
      month: monthOf(row),
      showMonth: i === 0 || monthOf(built[i - 1]) !== monthOf(row),
    }));
  }, [posts.data, timeZone, days]);

  const truncated = (posts.data?.pagination.total ?? 0) > (posts.data?.posts.length ?? 0);
  const canLoadMore = future < MAX_FUTURE_DAYS && !truncated;
  const loadMore = useCallback(() => setFuture((f) => Math.min(MAX_FUTURE_DAYS, f + STEP_DAYS)), []);
  const jumpToToday = () => todayRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });

  // Open on today, not on last week.
  useEffect(() => {
    if (scrolledToToday.current || posts.isLoading || !todayRef.current) return;
    scrolledToToday.current = true;
    todayRef.current.scrollIntoView({ block: "start" });
  }, [posts.isLoading]);

  // User input only: the jump to today on load scrolls too.
  useEffect(() => {
    const onScroll = () => {
      scrolledSinceLoad.current = true;
    };
    const events = ["wheel", "touchmove", "keydown"] as const;
    for (const e of events) window.addEventListener(e, onScroll, { passive: true });
    return () => {
      for (const e of events) window.removeEventListener(e, onScroll);
    };
  }, []);

  // Load more days when a scroll brings the bottom into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !canLoadMore || posts.isFetching) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!scrolledSinceLoad.current || !entries.some((e) => e.isIntersecting)) return;
        scrolledSinceLoad.current = false;
        loadMore();
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [canLoadMore, loadMore, posts.isFetching]);

  if (posts.isLoading) return <TimelineSkeleton />;
  if (posts.isError) {
    return <ErrorState title="Couldn't load your timeline" onRetry={() => void posts.refetch()} />;
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-1">
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setPast((p) => p + STEP_DAYS)}>
          <CaretUp data-icon="inline-start" />
          Show earlier days
        </Button>
        <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={jumpToToday}>
          <CalendarDots data-icon="inline-start" />
          Today
        </Button>
        <Link
          href="/scheduler/calendar"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
        >
          Calendar
          <ArrowRight data-icon="inline-end" />
        </Link>
      </div>

      <ol className="relative">
        {/* The spine the dates sit on. */}
        <span aria-hidden className="absolute top-0 bottom-0 left-7 w-px bg-border" />

        {rows.map(({ row, first, month, showMonth }) => [
          showMonth ? (
            <li key={`m-${month}`} aria-hidden className="relative pt-2 pb-4 pl-18">
              <span className="font-display text-base font-bold tracking-tight text-foreground">
                {monthYearFormat.format(first.date)}
              </span>
            </li>
          ) : null,
          row.kind === "gap" ? (
            <GapRow key={row.from.key} from={row.from} to={row.to} timeZone={timeZone} />
          ) : (
            <li
              key={row.day.key}
              ref={row.day.offset === 0 ? todayRef : undefined}
              className="relative flex scroll-mt-24 gap-4 pb-6"
            >
              <div className="sticky top-18 z-10 h-fit self-start bg-card py-1 md:top-20">
                <DateBadge day={row.day} />
              </div>
              <div className="min-w-0 flex-1 pt-3">
                {(() => {
                  const open = openSlots(row.day, row.posts, slots, timeZone);
                  if (row.posts.length) {
                    return (
                      <DayPosts day={row.day} posts={row.posts} open={open} timeZone={timeZone} onOpen={onOpenPost} />
                    );
                  }
                  if (open.length) {
                    return (
                      <div className="space-y-1.5">
                        {open.map((slot) => (
                          <OpenSlotLink key={slot.href} slot={slot} />
                        ))}
                      </div>
                    );
                  }
                  return (
                    <Link href={newPostHref(row.day, timeZone)} className={cn(EMPTY_SLOT, "py-3.5", ROW_FOCUS)}>
                      {row.day.offset === 0 ? "Nothing planned for today" : "Nothing planned"}
                      <AddPostHint />
                    </Link>
                  );
                })()}
              </div>
            </li>
          ),
        ])}
      </ol>

      <div ref={sentinelRef} className="flex justify-center py-6">
        {/* Only while new days load, not on a background refresh. */}
        {posts.isFetching && posts.isPlaceholderData ? (
          <Spinner className="size-5 text-muted-foreground" />
        ) : canLoadMore ? (
          <Button variant="outline" onClick={loadMore}>
            Show more days
          </Button>
        ) : truncated ? (
          <Link href="/scheduler/calendar" className={buttonVariants({ variant: "outline" })}>
            See the rest in Calendar
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">That&apos;s a year ahead.</p>
        )}
      </div>
    </div>
  );
}

export function HomeView() {
  const [openPostId, setOpenPostId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <AttentionNotice />
      <div className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <Timeline onOpenPost={setOpenPostId} />
        <aside className="order-first space-y-5 lg:sticky lg:top-24 lg:order-none">
          <GetStarted />
          <NextUp onOpenPost={setOpenPostId} />
          <Overview />
          <FromAgents />
        </aside>
      </div>
      <PostSheet postId={openPostId} onOpenChange={(open) => !open && setOpenPostId(null)} />
    </div>
  );
}
