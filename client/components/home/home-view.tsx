"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CalendarPlus,
  CheckCircle,
  Circle,
  Robot,
  Warning,
} from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageSection } from "@/components/layout/page-header";
import { AccountAvatar, AccountStack, accountLabel } from "@/components/scheduler/account-avatar";
import { PostSheet } from "@/components/scheduler/post-sheet";
import { PostStatusBadge } from "@/components/scheduler/post-status-badge";
import { PostThumb } from "@/components/scheduler/post-thumb";
import { useApiKeys } from "@/components/api-keys/use-api-keys";
import { useAnalyticsSummary } from "@/hooks/use-analytics";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { libraryItemTitle, libraryKindLabel, useLibraryPage } from "@/hooks/use-library";
import { usePostCounts, usePosts } from "@/hooks/use-posts";
import { usePostingSlots, useSchedulerTimezone } from "@/hooks/use-schedule";
import { dayKey, formatDay, formatRelative, formatTime } from "@/lib/scheduler/dates";
import { scheduleHref } from "@/lib/scheduler/formats";
import type { Post } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";

function PostRow({
  post,
  timeZone,
  onOpen,
  showTime = true,
}: {
  post: Post;
  timeZone: string;
  onOpen: (id: string) => void;
  showTime?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(post.id)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary"
      >
        {showTime ? (
          <span className="w-16 shrink-0 text-sm font-medium tabular-nums">
            {post.scheduledFor ? formatTime(post.scheduledFor, timeZone) : ""}
          </span>
        ) : null}
        <PostThumb post={post} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{post.mainCaption.trim() || "No caption"}</span>
          {!showTime ? (
            <span className="block text-xs text-muted-foreground">
              Edited {formatRelative(post.updatedAt)}
            </span>
          ) : null}
        </span>
        <span className="hidden sm:block">
          <AccountStack accounts={post.postAccounts.map((leg) => leg.account)} />
        </span>
      </button>
    </li>
  );
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

function Setup({
  hasAccounts,
  hasSlots,
  hasKey,
  hasPosts,
}: {
  hasAccounts: boolean;
  hasSlots: boolean;
  hasKey: boolean;
  hasPosts: boolean;
}) {
  const steps = [
    { done: hasAccounts, label: "Connect a social account", href: "/scheduler/accounts" },
    { done: hasSlots, label: "Set your posting times", href: "/scheduler/queue" },
    { done: hasKey, label: "Connect your AI agent", href: "/connect-agent" },
    { done: hasPosts, label: "Schedule your first post", href: "/scheduler/new" },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  return (
    <div className="rounded-xl bg-muted">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-medium">Get set up</p>
        <span className="text-xs text-muted-foreground tabular-nums">
          {done} of {steps.length}
        </span>
      </div>
      <ul className="divide-y">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary"
            >
              {step.done ? (
                <CheckCircle weight="fill" className="size-4 text-success" />
              ) : (
                <Circle className="size-4 text-muted-foreground" />
              )}
              <span className={cn("flex-1", step.done && "text-muted-foreground line-through")}>
                {step.label}
              </span>
              {!step.done ? <ArrowRight className="size-3.5 text-muted-foreground" /> : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HomeView() {
  const timeZone = useSchedulerTimezone();
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [now] = useState(() => new Date());
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const accounts = useConnectedAccounts();
  const counts = usePostCounts();
  const slots = usePostingSlots();
  const keys = useApiKeys();
  const upcoming = usePosts({
    status: ["SCHEDULED", "PUBLISHING"],
    from: now.toISOString(),
    to: weekAhead.toISOString(),
    sort: "scheduled",
    dir: "asc",
    limit: 50,
  });
  const failing = usePosts({
    status: ["FAILED", "PARTIALLY_PUBLISHED"],
    sort: "updated",
    dir: "desc",
    limit: 5,
  });
  const drafts = usePosts({ status: ["DRAFT"], sort: "updated", dir: "desc", limit: 5 });
  const fromAgents = useLibraryPage({ source: "api", limit: 6 });
  const stats = useAnalyticsSummary(7);

  const reconnect = (accounts.data ?? []).filter((a) => a.status !== "ok");
  const needsAttention = (failing.data?.posts.length ?? 0) + reconnect.length;

  const byDay = new Map<string, Post[]>();
  for (const post of upcoming.data?.posts ?? []) {
    const key = dayKey(post.scheduledFor!, timeZone);
    byDay.set(key, [...(byDay.get(key) ?? []), post]);
  }

  const c = counts.data?.counts;
  const tiles = [
    { label: "Scheduled", value: c ? c.SCHEDULED + c.PUBLISHING : null, href: "/scheduler/posts?status=scheduled" },
    { label: "Drafts", value: c?.DRAFT ?? null, href: "/scheduler/posts?status=drafts" },
    { label: "Published", value: c ? c.PUBLISHED + c.PARTIALLY_PUBLISHED : null, href: "/scheduler/posts?status=published" },
    { label: "Views, last 7 days", value: stats.data?.totals.views ?? (stats.isLoading ? null : 0), href: "/scheduler/analytics?days=7" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="rounded-xl bg-muted p-4 transition-colors hover:bg-secondary"
          >
            <p className="text-sm text-muted-foreground">{tile.label}</p>
            {tile.value === null ? (
              <Skeleton className="mt-2 h-7 w-12" />
            ) : (
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                {new Intl.NumberFormat(undefined, { notation: "compact" }).format(tile.value)}
              </p>
            )}
          </Link>
        ))}
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-8">
          {needsAttention > 0 ? (
            <PageSection title="Needs attention">
              <ul className="divide-y divide-destructive/15 rounded-xl bg-destructive/5">
                {reconnect.map((account) => (
                  <li key={account.id} className="flex items-center gap-3 px-3 py-2.5">
                    <AccountAvatar account={account} size="sm" />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium">{accountLabel(account)}</span>{" "}
                      <span className="text-muted-foreground">
                        {account.status === "reconnect" ? "needs to be reconnected" : "expires soon"}
                      </span>
                    </span>
                    <Link
                      href="/scheduler/accounts"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Reconnect
                    </Link>
                  </li>
                ))}
                {(failing.data?.posts ?? []).map((post) => (
                  <li key={post.id}>
                    <button
                      type="button"
                      onClick={() => setOpenPostId(post.id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary"
                    >
                      <Warning weight="fill" className="size-4 shrink-0 text-destructive" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">
                          {post.mainCaption.trim() || "No caption"}
                        </span>
                        <span className="block truncate text-xs text-destructive">
                          {post.error ?? "Didn't publish to every account"}
                        </span>
                      </span>
                      <PostStatusBadge status={post.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </PageSection>
          ) : null}

          <PageSection
            title="Up next"
            description="Scheduled for the next 7 days."
            actions={
              <Link href="/scheduler/calendar" className={buttonVariants({ variant: "ghost" })}>
                Calendar
                <ArrowRight />
              </Link>
            }
          >
            {upcoming.isLoading ? (
              <ListSkeleton />
            ) : byDay.size === 0 ? (
              <div className="flex flex-col items-start gap-3 rounded-xl bg-muted p-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">Nothing scheduled this week.</p>
                <Link href="/scheduler/new" className={buttonVariants({ size: "sm" })}>
                  <CalendarPlus />
                  Schedule a post
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {[...byDay.entries()].map(([key, posts]) => (
                  <div key={key} className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      {formatDay(posts[0].scheduledFor!, timeZone, true)}
                    </p>
                    <ul className="divide-y divide-card rounded-xl bg-muted">
                      {posts.map((post) => (
                        <PostRow key={post.id} post={post} timeZone={timeZone} onOpen={setOpenPostId} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </PageSection>
        </div>

        <aside className="space-y-8">
          <Setup
            hasAccounts={(accounts.data?.length ?? 0) > 0}
            hasSlots={(slots.data?.slots.length ?? 0) > 0}
            hasKey={(keys.data?.length ?? 0) > 0}
            hasPosts={(counts.data?.total ?? 0) > 0}
          />

          <PageSection
            title="From your agents"
            actions={
              <Link href="/files?source=api" className={buttonVariants({ variant: "ghost" })}>
                Library
                <ArrowRight />
              </Link>
            }
          >
            {fromAgents.isLoading ? (
              <ListSkeleton />
            ) : (fromAgents.data?.items.length ?? 0) === 0 ? (
              <div className="space-y-3 rounded-xl bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  Images and videos your agent makes through the Unsora MCP server or API show up
                  here, ready to schedule.
                </p>
                <Link href="/connect-agent" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <Robot />
                  Connect an agent
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-card rounded-xl bg-muted">
                {fromAgents.data!.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {item.thumbnailUrl || (item.mediaType === "image" && item.url) ? (
                        <img
                          src={item.thumbnailUrl ?? item.url!}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : item.mediaType === "video" && item.url ? (
                        <video src={`${item.url}#t=0.5`} muted preload="metadata" className="size-full object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{libraryItemTitle(item)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {libraryKindLabel(item.kind)} · {formatRelative(item.createdAt)}
                      </span>
                    </span>
                    {item.url && (item.mediaType === "video" || item.mediaType === "image") ? (
                      <Link
                        href={scheduleHref({ url: item.url, mediaType: item.mediaType })}
                        className={buttonVariants({ variant: "outline", size: "xs" })}
                      >
                        Schedule
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </PageSection>

          <PageSection
            title="Drafts"
            actions={
              <Link href="/scheduler/posts?status=drafts" className={buttonVariants({ variant: "ghost" })}>
                All drafts
                <ArrowRight />
              </Link>
            }
          >
            {drafts.isLoading ? (
              <ListSkeleton />
            ) : (drafts.data?.posts.length ?? 0) === 0 ? (
              <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                No drafts. Posts saved without a time wait here.
              </p>
            ) : (
              <ul className="divide-y divide-card rounded-xl bg-muted">
                {drafts.data!.posts.map((post) => (
                  <PostRow
                    key={post.id}
                    post={post}
                    timeZone={timeZone}
                    onOpen={setOpenPostId}
                    showTime={false}
                  />
                ))}
              </ul>
            )}
          </PageSection>
        </aside>
      </div>

      <PostSheet postId={openPostId} onOpenChange={(open) => !open && setOpenPostId(null)} />
    </div>
  );
}
