"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  Circle,
  NotePencil,
  Robot,
} from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageSection } from "@/components/layout/page-header";
import { ErrorState } from "@/components/shared/states";
import { AgentMediaList, AgentMediaRow } from "@/components/home/agent-media-row";
import { AccountStack } from "@/components/scheduler/account-avatar";
import { PostSheet } from "@/components/scheduler/post-sheet";
import { PostThumb } from "@/components/scheduler/post-thumb";
import { useApiKeys } from "@/components/api-keys/use-api-keys";
import { useAnalyticsSummary } from "@/hooks/use-analytics";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { libraryKindLabel, useLibraryPage } from "@/hooks/use-library";
import { usePostCounts, usePosts } from "@/hooks/use-posts";
import { usePostingSlots, useSchedulerTimezone } from "@/hooks/use-schedule";
import { dayKey, formatDay, formatRelative, formatTime } from "@/lib/scheduler/dates";
import type { Post } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";

const ROW_FOCUS =
  "outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset";

/** One-line empty message with an optional action, sized for list slots. */
function EmptyRow({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}

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
        className={cn(
          "flex w-full min-w-0 items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent",
          ROW_FOCUS,
        )}
      >
        {showTime ? (
          <span className="w-16 shrink-0 text-sm font-medium tabular-nums">
            {post.scheduledFor ? formatTime(post.scheduledFor, timeZone) : ""}
          </span>
        ) : null}
        <PostThumb post={post} className="rounded-lg bg-card" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{post.mainCaption.trim() || "No caption"}</span>
          {!showTime ? (
            <span className="block text-xs text-muted-foreground">
              Edited {formatRelative(post.updatedAt)}
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

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
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
    <div className="overflow-hidden rounded-xl bg-muted">
      <div className="flex items-center justify-between border-b border-card px-4 py-3">
        <h2 className="text-sm font-semibold">Get set up</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {done} of {steps.length}
        </span>
      </div>
      <ul className="divide-y divide-card">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent",
                ROW_FOCUS,
              )}
            >
              {step.done ? (
                <CheckCircle weight="fill" className="size-4 shrink-0 text-success" />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="sr-only">{step.done ? "Done:" : "To do:"}</span>
              <span className={cn("min-w-0 flex-1", step.done && "text-muted-foreground line-through")}>
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
  const drafts = usePosts({ status: ["DRAFT"], sort: "updated", dir: "desc", limit: 5 });
  const fromAgents = useLibraryPage({ source: "api", limit: 6 });
  const stats = useAnalyticsSummary(7);

  const byDay = new Map<string, Post[]>();
  for (const post of upcoming.data?.posts ?? []) {
    const key = dayKey(post.scheduledFor!, timeZone);
    byDay.set(key, [...(byDay.get(key) ?? []), post]);
  }

  const c = counts.data?.counts;
  const tiles = [
    { label: "Scheduled", value: c ? c.SCHEDULED + c.PUBLISHING : null, failed: counts.isError, href: "/scheduler/posts?status=scheduled" },
    { label: "Drafts", value: c?.DRAFT ?? null, failed: counts.isError, href: "/scheduler/posts?status=drafts" },
    { label: "Published", value: c ? c.PUBLISHED + c.PARTIALLY_PUBLISHED : null, failed: counts.isError, href: "/scheduler/posts?status=published" },
    { label: "Views, last 7 days", value: stats.data?.totals.views ?? (stats.isLoading || stats.isError ? null : 0), failed: stats.isError, href: "/scheduler/analytics?days=7" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className={cn(
              "min-w-0 rounded-xl bg-muted p-4 transition-colors hover:bg-accent",
              "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            )}
          >
            <p className="truncate text-sm text-muted-foreground">{tile.label}</p>
            {tile.failed && tile.value === null ? (
              <p
                className="mt-1 text-2xl font-semibold tracking-tight text-muted-foreground"
                title="Couldn't load this number"
              >
                <span aria-hidden>—</span>
                <span className="sr-only">Couldn&apos;t load</span>
              </p>
            ) : tile.value === null ? (
              <Skeleton className="mt-2 h-7 w-12" />
            ) : (
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                {new Intl.NumberFormat(undefined, { notation: "compact" }).format(tile.value)}
              </p>
            )}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-8">
          <PageSection
            title="Up next"
            description="Scheduled for the next 7 days."
            actions={
              <Link
                href="/scheduler/calendar"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-my-1.5 -mr-2")}
              >
                Calendar
                <ArrowRight data-icon="inline-end" />
              </Link>
            }
          >
            {upcoming.isLoading ? (
              <ListSkeleton />
            ) : upcoming.isError ? (
              <ErrorState
                title="Couldn't load upcoming posts"
                className="py-8"
                onRetry={() => void upcoming.refetch()}
              />
            ) : byDay.size === 0 ? (
              <EmptyRow
                action={
                  <Link
                    href="/scheduler/new"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <NotePencil />
                    New post
                  </Link>
                }
              >
                Nothing scheduled this week.
              </EmptyRow>
            ) : (
              <div className="space-y-4">
                {[...byDay.entries()].map(([key, posts]) => (
                  <div key={key} className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      {formatDay(posts[0].scheduledFor!, timeZone, true)}
                    </p>
                    <ul className="divide-y divide-card overflow-hidden rounded-xl bg-muted">
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

        <aside className="min-w-0 space-y-8">
          <Setup
            hasAccounts={(accounts.data?.length ?? 0) > 0}
            hasSlots={(slots.data?.slots.length ?? 0) > 0}
            hasKey={(keys.data?.length ?? 0) > 0}
            hasPosts={(counts.data?.total ?? 0) > 0}
          />

          <PageSection
            title="From your agents"
            actions={
              <Link
                href="/files?source=api"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-my-1.5 -mr-2")}
              >
                Library
                <ArrowRight data-icon="inline-end" />
              </Link>
            }
          >
            {fromAgents.isLoading ? (
              <ListSkeleton />
            ) : fromAgents.isError ? (
              <ErrorState
                title="Couldn't load agent files"
                className="py-8"
                onRetry={() => void fromAgents.refetch()}
              />
            ) : (fromAgents.data?.items.length ?? 0) === 0 ? (
              <EmptyRow
                action={
                  <Link
                    href="/connect-agent"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <Robot />
                    Connect an agent
                  </Link>
                }
              >
                Images and videos your agent makes through the Unsora MCP server or API show up
                here, ready to schedule.
              </EmptyRow>
            ) : (
              <AgentMediaList>
                {fromAgents.data!.items.map((item) => (
                  <AgentMediaRow
                    key={item.id}
                    item={item}
                    meta={`${libraryKindLabel(item.kind)} · ${formatRelative(item.createdAt)}`}
                  />
                ))}
              </AgentMediaList>
            )}
          </PageSection>

          <PageSection
            title="Drafts"
            actions={
              <Link
                href="/scheduler/posts?status=drafts"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-my-1.5 -mr-2")}
              >
                All drafts
                <ArrowRight data-icon="inline-end" />
              </Link>
            }
          >
            {drafts.isLoading ? (
              <ListSkeleton />
            ) : drafts.isError ? (
              <ErrorState
                title="Couldn't load drafts"
                className="py-8"
                onRetry={() => void drafts.refetch()}
              />
            ) : (drafts.data?.posts.length ?? 0) === 0 ? (
              <EmptyRow>No drafts. Posts saved without a time show up here.</EmptyRow>
            ) : (
              <ul className="divide-y divide-card overflow-hidden rounded-xl bg-muted">
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
