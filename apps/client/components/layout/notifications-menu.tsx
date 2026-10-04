"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowSquareOut,
  ArrowsClockwise,
  Bell,
  CheckCircle,
  Clock,
  Coins,
  Plugs,
  Robot,
  Sparkle,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { AccountAvatar, accountLabel } from "@/components/scheduler/account-avatar";
import { PostSheet } from "@/components/scheduler/post-sheet";
import { PostThumb } from "@/components/scheduler/post-thumb";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import {
  libraryItemTitle,
  libraryKindLabel,
  useLibraryPage,
  type LibraryItem,
} from "@/hooks/use-library";
import { usePosts, useRetryPost } from "@/hooks/use-posts";
import { useUserUsage } from "@/hooks/use-user-usage";
import { formatRelative } from "@/lib/scheduler/dates";
import { platformName } from "@/lib/scheduler/formats";
import type { Post } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";

const SEEN_KEY = "notifications-seen-at";
const LOW_CREDITS = 100;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type Tone = "danger" | "warning" | "success" | "info" | "neutral";

const TONE_TILE: Record<Tone, string> = {
  danger: "bg-destructive-subtle text-destructive",
  warning: "bg-warning-subtle text-warning",
  success: "bg-success-subtle text-success",
  info: "bg-info-subtle text-info",
  neutral: "bg-muted text-foreground",
};

const TONE_DOT: Record<Tone, string> = {
  danger: "bg-destructive text-destructive-foreground",
  warning: "bg-warning text-warning-foreground",
  success: "bg-success text-success-foreground",
  info: "bg-info text-info-foreground",
  neutral: "bg-foreground text-background",
};

interface Notice {
  id: string;
  tone: Tone;
  /** Epoch ms. Future times are upcoming posts. */
  time: number;
  /** Shown under "Needs action" and kept at the top until it's resolved. */
  actionable: boolean;
  /** Counted on the bell until the menu is opened. */
  counts: boolean;
  visual: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  href?: string;
  onSelect?: () => void;
}

/**
 * Publishing errors can be raw provider or worker text. Show a plain line and
 * keep the original in the tooltip.
 */
function friendlyPostError(error: string | null | undefined) {
  if (!error) return "Didn't publish to every account";
  if (/^Failed to publish/i.test(error) && error.length <= 80) return error;
  if (/time(d)? ?out/i.test(error)) return "Publishing timed out";
  return "Couldn't publish this post";
}

function listPlatforms(providers: string[]) {
  const names = [...new Set(providers)].map(platformName);
  if (names.length === 0) return "your accounts";
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

/** Last time the menu was opened. A first visit counts the past week as new. */
function readSeenAt() {
  const fallback = Date.now() - 7 * DAY;
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || fallback;
  } catch {
    return fallback;
  }
}

function dayGroup(time: number, now: number) {
  if (time > now) return "Coming up";
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (time >= today.getTime()) return "Today";
  if (time >= today.getTime() - DAY) return "Yesterday";
  if (time >= today.getTime() - 6 * DAY) return "This week";
  return "Earlier";
}

/** An icon in a tinted tile. */
function IconTile({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5", TONE_TILE[tone])}>
      {children}
    </span>
  );
}

/** A thumbnail with a small status dot in the corner. */
function ThumbWithDot({
  tone,
  icon,
  children,
}: {
  tone: Tone;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="relative shrink-0">
      {children}
      <span
        className={cn(
          "absolute -right-1 -bottom-1 flex size-4.5 items-center justify-center rounded-full ring-2 ring-popover [&_svg]:size-3",
          TONE_DOT[tone],
        )}
      >
        {icon}
      </span>
    </span>
  );
}

/** A creation's preview. `stacked` adds a card peeking out behind it. */
function LibraryThumb({ item, stacked }: { item: LibraryItem; stacked?: boolean }) {
  const src = item.thumbnailUrl ?? (item.mediaType === "image" ? item.url : null);
  return (
    <span className="relative block size-10 shrink-0">
      {stacked ? (
        <span className="absolute inset-0 translate-x-1 -translate-y-1 rotate-6 rounded-lg bg-accent ring-1 ring-border" />
      ) : null}
      <span className="relative flex size-10 items-center justify-center overflow-hidden rounded-lg bg-accent text-muted-foreground ring-1 ring-border">
        {src ? (
          <img src={src} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <Sparkle className="size-5" />
        )}
      </span>
    </span>
  );
}

function RetryButton({ post }: { post: Post }) {
  const retry = useRetryPost();
  return (
    <Button
      variant="secondary"
      size="xs"
      disabled={retry.isPending}
      onClick={() => retry.mutate(post.id)}
    >
      {retry.isPending ? <Spinner /> : <ArrowsClockwise />}
      Retry
    </Button>
  );
}

function NoticeRow({ notice, unread }: { notice: Notice; unread: boolean }) {
  const content = (
    <>
      {notice.visual}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm leading-snug font-medium">{notice.title}</span>
        {notice.body ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{notice.body}</span>
        ) : null}
        <span className="mt-1 block text-xs text-muted-foreground">
          {formatRelative(new Date(notice.time))}
        </span>
      </span>
    </>
  );
  const main = "flex min-w-0 flex-1 items-start gap-3 text-left outline-none";

  return (
    <li
      className={cn(
        "relative flex items-center gap-2 px-4 py-3 transition-colors focus-within:bg-accent hover:bg-accent",
        unread && "bg-muted",
      )}
    >
      {unread ? (
        <span className="absolute top-1/2 left-1.5 size-1.5 -translate-y-1/2 rounded-full bg-destructive" aria-label="New" />
      ) : null}
      {notice.href ? (
        <Link href={notice.href} className={main} onClick={notice.onSelect}>
          {content}
        </Link>
      ) : (
        <button type="button" className={main} onClick={notice.onSelect}>
          {content}
        </button>
      )}
      {notice.action ? <span className="shrink-0">{notice.action}</span> : null}
    </li>
  );
}

/**
 * The bell in the page header: one feed for everything that happened in the
 * account (posts going out, posts that failed, new creations, credits, and
 * accounts to reconnect), with the things that need a hand pinned on top.
 */
export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "action">("all");
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const [seenAt, setSeenAt] = useState(() =>
    typeof window === "undefined" ? 0 : readSeenAt(),
  );
  // What counts as "new" while the menu is open: the last visit, not this one.
  const [highlightSince, setHighlightSince] = useState(seenAt);

  const accounts = useConnectedAccounts();
  const usage = useUserUsage();
  const published = usePosts({ status: ["PUBLISHED"], sort: "published", dir: "desc", limit: 6 });
  const failed = usePosts({
    status: ["FAILED", "PARTIALLY_PUBLISHED"],
    sort: "updated",
    dir: "desc",
    limit: 6,
  });
  const upcoming = usePosts({
    status: ["SCHEDULED"],
    from: new Date(now).toISOString(),
    to: new Date(now + HOUR).toISOString(),
    sort: "scheduled",
    dir: "asc",
    limit: 3,
  });
  const library = useLibraryPage({ status: "all", limit: 10 });

  const close = () => setOpen(false);
  const openPost = (id: string) => {
    close();
    setOpenPostId(id);
  };

  const notices: Notice[] = [];

  for (const account of accounts.data ?? []) {
    if (account.status === "ok") continue;
    const broken = account.status === "reconnect";
    notices.push({
      id: `account-${account.id}`,
      tone: broken ? "danger" : "warning",
      time: now,
      actionable: true,
      counts: broken,
      visual: (
        <ThumbWithDot tone={broken ? "danger" : "warning"} icon={<Plugs weight="bold" />}>
          <AccountAvatar account={account} size="md" className="m-0.5" />
        </ThumbWithDot>
      ),
      title: broken ? `${accountLabel(account)} is disconnected` : `${accountLabel(account)} expires soon`,
      body: broken
        ? `Posts to ${platformName(account.provider)} will fail until you reconnect.`
        : "Reconnect now so scheduled posts keep going out.",
      href: "/scheduler/accounts",
      onSelect: close,
      action: (
        <Link href="/scheduler/accounts" onClick={close} className={buttonVariants({ size: "xs" })}>
          Reconnect
        </Link>
      ),
    });
  }

  const user = usage.usage?.user;
  if (user?.isActive && user.isCancelled && user.stripeCurrentPeriodEnd) {
    const ends = new Date(user.stripeCurrentPeriodEnd);
    notices.push({
      id: "plan-ending",
      tone: "warning",
      time: now,
      actionable: true,
      counts: false,
      visual: <IconTile tone="warning"><WarningCircle weight="fill" /></IconTile>,
      title: `Your ${user.plan} plan ends ${ends.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
      body: "Renew to keep your monthly credits.",
      href: "/billing",
      onSelect: close,
    });
  }

  const credits = usage.usage?.credits;
  if (credits !== undefined && credits < LOW_CREDITS) {
    notices.push({
      id: "credits-low",
      tone: "warning",
      time: now,
      actionable: true,
      counts: false,
      visual: <IconTile tone="warning"><Coins weight="fill" /></IconTile>,
      title: credits <= 0 ? "You're out of credits" : "Running low on credits",
      body: `${credits.toLocaleString()} credits left.`,
      href: "/billing",
      onSelect: close,
      action: (
        <Link href="/billing" onClick={close} className={buttonVariants({ size: "xs" })}>
          Buy credits
        </Link>
      ),
    });
  }

  for (const post of upcoming.data?.posts ?? []) {
    if (!post.scheduledFor) continue;
    notices.push({
      id: `upcoming-${post.id}`,
      tone: "info",
      time: new Date(post.scheduledFor).getTime(),
      actionable: false,
      counts: false,
      visual: (
        <ThumbWithDot tone="info" icon={<Clock weight="bold" />}>
          <PostThumb post={post} />
        </ThumbWithDot>
      ),
      title: `Going out to ${listPlatforms(post.postAccounts.map((l) => l.account.provider))}`,
      body: post.mainCaption.trim() || "No caption",
      onSelect: () => openPost(post.id),
    });
  }

  for (const post of failed.data?.posts ?? []) {
    const failedLegs = post.postAccounts.filter((l) => !l.published);
    const partial = post.status === "PARTIALLY_PUBLISHED";
    notices.push({
      id: `failed-${post.id}`,
      tone: "danger",
      time: new Date(post.updatedAt).getTime(),
      actionable: true,
      counts: true,
      visual: (
        <ThumbWithDot tone="danger" icon={<Warning weight="fill" />}>
          <PostThumb post={post} />
        </ThumbWithDot>
      ),
      title: failedLegs.length
        ? `Couldn't post to ${listPlatforms(failedLegs.map((l) => l.account.provider))}`
        : partial
          ? "Some accounts didn't get this post"
          : "A post didn't go out",
      body: (
        <span title={post.error ?? undefined}>
          {friendlyPostError(post.error)} · {post.mainCaption.trim() || "No caption"}
        </span>
      ),
      onSelect: () => openPost(post.id),
      action: <RetryButton post={post} />,
    });
  }

  for (const post of published.data?.posts ?? []) {
    const live = post.postAccounts.find((l) => l.publishedUrl)?.publishedUrl;
    notices.push({
      id: `published-${post.id}`,
      tone: "success",
      time: new Date(post.publishedAt ?? post.updatedAt).getTime(),
      actionable: false,
      counts: true,
      visual: (
        <ThumbWithDot tone="success" icon={<CheckCircle weight="fill" />}>
          <PostThumb post={post} />
        </ThumbWithDot>
      ),
      title: `Posted to ${listPlatforms(post.postAccounts.map((l) => l.account.provider))}`,
      body: post.mainCaption.trim() || "No caption",
      onSelect: () => openPost(post.id),
      action: live ? (
        <a
          href={live}
          target="_blank"
          rel="noreferrer"
          aria-label="View the live post (opens in a new tab)"
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
        >
          <ArrowSquareOut />
        </a>
      ) : undefined,
    });
  }

  // Batches of the same kind on the same day collapse into one stacked row.
  const batches = new Map<string, LibraryItem[]>();
  for (const item of library.data?.items ?? []) {
    if (item.kind === "upload") continue;
    const status = item.status.toUpperCase();
    const state =
      status === "COMPLETED" || status === "SUCCEEDED"
        ? "done"
        : status === "FAILED" || status === "ERROR"
          ? "failed"
          : "running";
    const key = [state, item.kind, item.source, new Date(item.createdAt).toDateString()].join("|");
    batches.set(key, [...(batches.get(key) ?? []), item]);
  }
  for (const [key, items] of batches) {
    const [state] = key.split("|");
    const item = items[0];
    const done = state === "done";
    const failedJob = state === "failed";
    const kind = libraryKindLabel(item.kind).toLowerCase();
    const byAgent = item.source === "api";
    const many = items.length > 1;
    notices.push({
      id: `library-${key}`,
      tone: failedJob ? "danger" : done ? "neutral" : "info",
      time: new Date(item.createdAt).getTime(),
      actionable: false,
      counts: done || failedJob,
      visual: (
        <ThumbWithDot
          tone={failedJob ? "danger" : byAgent ? "neutral" : done ? "success" : "info"}
          icon={
            failedJob ? <Warning weight="fill" /> : byAgent ? <Robot weight="fill" /> : done ? <Sparkle weight="fill" /> : <Spinner />
          }
        >
          <LibraryThumb item={item} stacked={many} />
        </ThumbWithDot>
      ),
      title: failedJob
        ? many
          ? `${items.length} ${kind} jobs didn't finish`
          : `Your ${kind} didn't finish`
        : done
          ? byAgent
            ? many
              ? `Your agent made ${items.length} new ${kind} files`
              : `Your agent made a new ${kind}`
            : many
              ? `${items.length} new ${kind} files are ready`
              : `Your ${kind} is ready`
          : `Creating your ${kind}…`,
      body: libraryItemTitle(item),
      href: byAgent ? "/files?source=api" : "/files",
      onSelect: close,
    });
  }

  const pinned = notices.filter((n) => n.actionable && !n.id.startsWith("failed-"));
  const feed = notices
    .filter((n) => !pinned.includes(n))
    .sort((a, b) => b.time - a.time)
    .slice(0, 20);
  const actionItems = notices.filter((n) => n.actionable);
  const unread = notices.filter((n) => n.counts && n.time > seenAt && n.time <= now).length;
  const brokenAccounts = notices.filter((n) => n.id.startsWith("account-") && n.counts).length;
  const badge = unread + brokenAccounts;
  const isUnread = (n: Notice) => n.counts && n.time > highlightSince && n.time <= now;

  const groups: { label: string; items: Notice[] }[] = [];
  if (tab === "all") {
    if (pinned.length) groups.push({ label: "Needs action", items: pinned });
    for (const notice of feed) {
      const label = dayGroup(notice.time, now);
      const group = groups.find((g) => g.label === label);
      if (group) group.items.push(notice);
      else groups.push({ label, items: [notice] });
    }
  } else if (actionItems.length) {
    groups.push({ label: "Needs action", items: actionItems });
  }

  const loading = published.isLoading && failed.isLoading && library.isLoading;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setHighlightSince(seenAt);
    const stamp = Date.now();
    setSeenAt(stamp);
    try {
      localStorage.setItem(SEEN_KEY, String(stamp));
    } catch {
      // Storage blocked: the badge just comes back on reload.
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={badge > 0 ? `Notifications, ${badge} new` : "Notifications"}
              className="relative"
            />
          }
        >
          <Bell className="size-5" />
          {badge > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-2xs font-semibold text-destructive-foreground tabular-nums ring-2 ring-card">
              {badge > 9 ? "9+" : badge}
            </span>
          ) : null}
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-104 max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0"
        >
          <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
            <p className="text-base font-semibold">Notifications</p>
            <div className="flex items-center rounded-lg bg-muted p-0.5 text-xs font-medium">
              {(
                [
                  ["all", "All"],
                  ["action", "Needs action"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={tab === value}
                  onClick={() => setTab(value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-muted-foreground transition-colors",
                    tab === value && "bg-card text-foreground",
                  )}
                >
                  {label}
                  {value === "action" && actionItems.length ? (
                    <span className="rounded-full bg-destructive px-1.5 text-2xs leading-4 text-destructive-foreground tabular-nums">
                      {actionItems.length}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[min(32rem,70svh)] overflow-y-auto border-t">
            {loading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-success-subtle text-success">
                  <CheckCircle weight="fill" className="size-6" />
                </span>
                <p className="font-medium">
                  {tab === "action" ? "Nothing needs you" : "No notifications yet"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tab === "action"
                    ? "Failed posts and accounts to reconnect show up here."
                    : "Published posts, new creations and alerts show up here."}
                </p>
              </div>
            ) : (
              groups.map((group) => (
                <section key={group.label}>
                  <p className="sticky top-0 z-10 bg-popover px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">
                    {group.label}
                  </p>
                  <ul>
                    {group.items.map((notice) => (
                      <NoticeRow key={notice.id} notice={notice} unread={isUnread(notice)} />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>

          <div className="flex items-center justify-between border-t px-2 py-1.5">
            <Link
              href="/scheduler/posts"
              onClick={close}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              All posts
            </Link>
            <Link
              href="/files"
              onClick={close}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Library
            </Link>
          </div>
        </PopoverContent>
      </Popover>

      <PostSheet postId={openPostId} onOpenChange={(next) => !next && setOpenPostId(null)} />
    </>
  );
}
