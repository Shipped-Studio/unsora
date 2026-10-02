"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ArrowsClockwise,
  ArrowSquareOut,
  ChartBar,
  Eye,
  Heart,
  ChatCircle,
  ShareFat,
} from "@phosphor-icons/react";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { TrendChart } from "@/components/scheduler/analytics/trend-chart";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Metrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

interface AnalyticsPost {
  postAccountId: string;
  platform: string;
  accountUsername: string | null;
  caption: string;
  postType: string;
  publishedAt: string | null;
  publishedUrl: string | null;
  metrics: Metrics;
  lastFetchedAt: string | null;
}

interface AnalyticsSummary {
  days: number;
  totals: Metrics;
  postCount: number;
  byPlatform: (Metrics & { platform: string; posts: number })[];
  timeseries: {
    date: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }[];
  posts: AnalyticsPost[];
}

const RANGES = [7, 30, 90] as const;

type TrendMetric = "views" | "likes" | "comments" | "shares";

const TREND_METRICS: { key: TrendMetric; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
];

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  google: "YouTube",
  threads: "Threads",
  bluesky: "Bluesky",
  pinterest: "Pinterest",
  linkedin: "LinkedIn",
};

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

/** Full-page loading skeleton mirroring the real layout. */
function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-3 p-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend chart — the real SVG scales with width (640×220 viewBox),
          so the placeholder keeps the same aspect ratio to avoid a shift. */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-64 max-w-full" />
          </div>
          <Skeleton className="h-8 w-64 rounded-lg" />
        </CardHeader>
        <CardContent>
          <Skeleton className="aspect-[640/220] w-full" />
        </CardContent>
      </Card>

      {/* Platform breakdown */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Posts table */}
      <Card>
        <CardHeader className="space-y-1.5">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-3.5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="hidden h-4 w-12 sm:block" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-full bg-muted p-2.5">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-2xl font-semibold leading-tight">
            {formatCompact(value)}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { authFetch } = useAuthFetch();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("views");

  const loadSummary = useCallback(
    async (selectedDays: number) => {
      const response = await authFetch(
        `/api/posts/analytics/summary?days=${selectedDays}`,
      );
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to load analytics");
      }
      setSummary(data.data);
    },
    [authFetch],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadSummary(days)
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Failed to load analytics",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, loadSummary]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await authFetch("/api/posts/analytics/refresh", {
        method: "POST",
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to refresh metrics");
      }
      await loadSummary(days);
      toast.success(
        data.data.refreshed > 0
          ? `Refreshed metrics for ${data.data.refreshed} post${data.data.refreshed === 1 ? "" : "s"}`
          : "No published posts to refresh yet",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to refresh metrics",
      );
    } finally {
      setRefreshing(false);
    }
  };

  const trendData = useMemo(
    () =>
      (summary?.timeseries ?? []).map((point) => ({
        date: point.date,
        value: point[trendMetric],
      })),
    [summary, trendMetric],
  );

  const hasData = (summary?.postCount ?? 0) > 0;
  const maxPlatformViews = Math.max(
    ...(summary?.byPlatform.map((p) => p.views) ?? [0]),
    1,
  );

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Views, likes, comments and shares across your published posts
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Time range filter */}
          <div className="inline-flex rounded-lg border bg-muted p-1">
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setDays(range)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  days === range
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {range}d
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            {refreshing ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <ArrowsClockwise className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <AnalyticsSkeleton />
      ) : !hasData ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mb-3 flex justify-center">
              <div className="rounded-full bg-muted p-3">
                <ChartBar className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
            <p className="text-sm font-medium">No published posts yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Metrics appear here once your posts go live. They refresh
              automatically every 6 hours.
            </p>
          </CardContent>
        </Card>
      ) : (
        summary && (
          <div className="space-y-6">
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile icon={Eye} label="Views" value={summary.totals.views} />
              <StatTile
                icon={Heart}
                label="Likes"
                value={summary.totals.likes}
              />
              <StatTile
                icon={ChatCircle}
                label="Comments"
                value={summary.totals.comments}
              />
              <StatTile
                icon={ShareFat}
                label="Shares"
                value={summary.totals.shares}
              />
            </div>

            {/* Trend */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Growth over time</CardTitle>
                  <CardDescription>
                    Cumulative totals across all posts in the last {days} days
                  </CardDescription>
                </div>
                <div className="inline-flex rounded-lg border bg-muted p-1">
                  {TREND_METRICS.map((metric) => (
                    <button
                      key={metric.key}
                      type="button"
                      onClick={() => setTrendMetric(metric.key)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                        trendMetric === metric.key
                          ? "bg-background shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {metric.label}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <TrendChart data={trendData} formatValue={formatCompact} />
              </CardContent>
            </Card>

            {/* Platform breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">By platform</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {summary.byPlatform.map((platform) => (
                  <div key={platform.platform} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {PLATFORM_LABELS[platform.platform] ??
                          platform.platform}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {platform.posts} post{platform.posts === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatCompact(platform.views)} views ·{" "}
                        {formatCompact(platform.likes)} likes ·{" "}
                        {formatCompact(platform.comments)} comments
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.max(2, (platform.views / maxPlatformViews) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Per-post table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Posts</CardTitle>
                <CardDescription>
                  Latest metrics per published post
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Post</th>
                        <th className="pb-2 pr-4 font-medium">Platform</th>
                        <th className="pb-2 pr-4 text-right font-medium">
                          Views
                        </th>
                        <th className="pb-2 pr-4 text-right font-medium">
                          Likes
                        </th>
                        <th className="pb-2 pr-4 text-right font-medium">
                          Comments
                        </th>
                        <th className="pb-2 pr-4 text-right font-medium">
                          Shares
                        </th>
                        <th className="pb-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {summary.posts.map((post) => (
                        <tr
                          key={post.postAccountId}
                          className="border-b last:border-0"
                        >
                          <td className="max-w-[260px] py-2.5 pr-4">
                            <p className="truncate" title={post.caption}>
                              {post.caption}
                            </p>
                            {post.publishedAt && (
                              <p className="text-xs text-muted-foreground">
                                {new Date(
                                  post.publishedAt,
                                ).toLocaleDateString()}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 pr-4">
                            <Badge variant="secondary" className="text-xs">
                              {PLATFORM_LABELS[post.platform] ?? post.platform}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-4 text-right tabular-nums">
                            {formatCompact(post.metrics.views)}
                          </td>
                          <td className="py-2.5 pr-4 text-right tabular-nums">
                            {formatCompact(post.metrics.likes)}
                          </td>
                          <td className="py-2.5 pr-4 text-right tabular-nums">
                            {formatCompact(post.metrics.comments)}
                          </td>
                          <td className="py-2.5 pr-4 text-right tabular-nums">
                            {formatCompact(post.metrics.shares)}
                          </td>
                          <td className="py-2.5 text-right">
                            {post.publishedUrl && (
                              <a
                                href={post.publishedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex text-muted-foreground transition-colors hover:text-foreground"
                                aria-label="Open post"
                              >
                                <ArrowSquareOut className="h-4 w-4" />
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Metrics refresh automatically every 6 hours. Instagram views,
                  shares and saves require reconnecting your Instagram account
                  (to grant the insights permission).
                </p>
              </CardContent>
            </Card>
          </div>
        )
      )}
    </div>
  );
}
