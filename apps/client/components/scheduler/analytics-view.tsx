"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { ArrowSquareOut, ArrowsClockwise, ChartBar } from "@phosphor-icons/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageSection } from "@/components/layout/page-header";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { PlatformIcon } from "@/components/scheduler/platform-icon";
import { Spinner } from "@/components/ui/spinner";
import { TrendChart } from "./trend-chart";
import {
  useAnalyticsSummary,
  useRefreshAnalytics,
  type AnalyticsSummary,
  type Metrics,
} from "@/hooks/use-analytics";
import { useSchedulerTimezone } from "@/hooks/use-schedule";
import { formatDayTime } from "@/lib/scheduler/dates";
import { platformName } from "@/lib/scheduler/formats";
import { cn } from "@/lib/utils";

type MetricKey = "views" | "likes" | "comments" | "shares";

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
];

/** Metrics each platform doesn't report, so zeros aren't misread. */
const MISSING: Record<string, MetricKey[]> = {
  bluesky: ["views"],
  linkedin: ["views", "shares"],
  google: ["shares"],
};

const compact = (n: number) =>
  new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);

function StatTile({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-xl bg-muted p-4 text-left transition-colors hover:bg-secondary",
        active && "border-foreground/30 bg-muted",
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{compact(value)}</p>
    </button>
  );
}

function perDay(series: AnalyticsSummary["timeseries"], key: MetricKey) {
  return series.map((point, i) => ({
    date: point.date,
    value: i === 0 ? 0 : Math.max(0, point[key] - series[i - 1][key]),
  }));
}

export function AnalyticsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const zone = useSchedulerTimezone();
  const days = [7, 30, 90].includes(Number(searchParams.get("days")))
    ? Number(searchParams.get("days"))
    : 30;
  const metric = (METRICS.find((m) => m.key === searchParams.get("metric"))?.key ??
    "views") as MetricKey;
  const mode = searchParams.get("mode") === "total" ? "total" : "daily";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const { data, isLoading, error, refetch } = useAnalyticsSummary(days);
  const refresh = useRefreshAnalytics();

  const series = useMemo(() => {
    if (!data) return [];
    return mode === "total"
      ? data.timeseries.map((p) => ({ date: p.date, value: p[metric] }))
      : perDay(data.timeseries, metric);
  }, [data, metric, mode]);

  const platforms = useMemo(() => {
    const rows = [...(data?.byPlatform ?? [])].sort((a, b) => b[metric] - a[metric]);
    const max = Math.max(1, ...rows.map((r) => r[metric]));
    return rows.map((row) => ({ ...row, share: row[metric] / max }));
  }, [data, metric]);

  const topPosts = useMemo(
    () => [...(data?.posts ?? [])].sort((a, b) => b.metrics[metric] - a.metrics[metric]).slice(0, 15),
    [data, metric],
  );

  const metricLabel = METRICS.find((m) => m.key === metric)!.label;

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs value={String(days)} onValueChange={(v) => setParam("days", v as string)}>
        <TabsList>
          <TabsTrigger value="7">7 days</TabsTrigger>
          <TabsTrigger value="30">30 days</TabsTrigger>
          <TabsTrigger value="90">90 days</TabsTrigger>
        </TabsList>
      </Tabs>
      <Button
        variant="outline"
        size="sm"
        className="ml-auto"
        disabled={refresh.isPending}
        onClick={() => refresh.mutate()}
      >
        {refresh.isPending ? <Spinner /> : <ArrowsClockwise />}
        {refresh.isPending ? "Updating stats" : "Update stats"}
      </Button>
    </div>
  );

  if (error) {
    return (
      <div className="space-y-6">
        {toolbar}
        <ErrorState title="Couldn't load analytics" description={error.message} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        {toolbar}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {METRICS.map((m) => (
            <Skeleton key={m.key} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  if (data.postCount === 0) {
    return (
      <div className="space-y-6">
        {toolbar}
        <EmptyState
          icon={ChartBar}
          title={`Nothing published in the last ${days} days`}
          description="Stats appear here once posts go out. They update every few hours, or when you press Update stats."
          action={{ label: "New post", href: "/scheduler/new" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {toolbar}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {METRICS.map((m) => (
          <StatTile
            key={m.key}
            label={m.label}
            value={data.totals[m.key]}
            active={metric === m.key}
            onClick={() => setParam("metric", m.key)}
          />
        ))}
      </div>

      <PageSection
        title={`${metricLabel} ${mode === "total" ? "to date" : "per day"}`}
        description={`Across ${data.postCount} published ${data.postCount === 1 ? "post" : "posts"} from the last ${days} days.`}
        actions={
          <Tabs value={mode} onValueChange={(v) => setParam("mode", v as string)}>
            <TabsList>
              <TabsTrigger value="daily">Per day</TabsTrigger>
              <TabsTrigger value="total">Running total</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        <div className="rounded-xl bg-muted p-4">
          <TrendChart points={series} label={metricLabel} />
        </div>
      </PageSection>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <PageSection title={`${metricLabel} by platform`}>
          <ul className="space-y-3 rounded-xl bg-muted p-4">
            {platforms.map((row) => {
              const missing = MISSING[row.platform]?.includes(metric);
              return (
                <li key={row.platform} className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <PlatformIcon provider={row.platform} />
                    <span className="flex-1">{platformName(row.platform)}</span>
                    <span className="text-xs text-muted-foreground">
                      {row.posts} {row.posts === 1 ? "post" : "posts"}
                    </span>
                    <span className="w-14 text-right font-medium tabular-nums">
                      {missing ? "n/a" : compact(row[metric])}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-chart-1"
                      style={{ width: `${missing ? 0 : Math.max(2, row.share * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            Bluesky doesn&apos;t report views. LinkedIn doesn&apos;t report views or shares.
            YouTube doesn&apos;t report shares.
          </p>
        </PageSection>

        <PageSection title={`Top posts by ${metricLabel.toLowerCase()}`}>
          <div className="overflow-hidden rounded-xl">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Post</TableHead>
                  {METRICS.map((m) => (
                    <TableHead
                      key={m.key}
                      className={cn("text-right", m.key !== metric && "hidden md:table-cell")}
                    >
                      {m.label}
                    </TableHead>
                  ))}
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPosts.map((post) => (
                  <TableRow key={post.postAccountId}>
                    <TableCell className="max-w-0 w-full">
                      <div className="flex items-center gap-2.5">
                        <PlatformIcon provider={post.platform} />
                        <div className="min-w-0">
                          <p className="truncate text-sm">{post.caption || "No caption"}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {post.accountUsername ?? platformName(post.platform)}
                            {post.publishedAt ? ` · ${formatDayTime(post.publishedAt, zone)}` : ""}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    {METRICS.map((m) => (
                      <TableCell
                        key={m.key}
                        className={cn(
                          "text-right tabular-nums",
                          m.key === metric ? "font-medium" : "hidden text-muted-foreground md:table-cell",
                        )}
                      >
                        {MISSING[post.platform]?.includes(m.key)
                          ? "n/a"
                          : compact((post.metrics as Metrics)[m.key])}
                      </TableCell>
                    ))}
                    <TableCell>
                      {post.publishedUrl ? (
                        <a
                          href={post.publishedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open post"
                          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                        >
                          <ArrowSquareOut />
                        </a>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Stats refresh every 6 hours.{" "}
            <Link href="/scheduler/posts?status=published" className="underline-offset-2 hover:underline">
              See all published posts
            </Link>
          </p>
        </PageSection>
      </div>
    </div>
  );
}
