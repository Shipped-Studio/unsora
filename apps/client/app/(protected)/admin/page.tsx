"use client";

import { useState } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { RangeSelect } from "@/components/admin/range-select";
import {
  AreaChart,
  BarList,
  ChartCard,
  DonutChart,
  StatTile,
  kindLabel,
  statusColor,
} from "@/components/admin/charts";
import { TableShell, Td, Th } from "@/components/admin/data-table";
import { PageSection } from "@/components/layout/page-header";
import { ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminOverview } from "@/hooks/admin/use-admin-data";
import { compactNumber, providerLabel, titleCase } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

export default function AdminOverviewPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error, refetch } = useAdminOverview(days);

  return (
    <AdminPage
      isRoot
      title="Admin"
      description="Activity across Unsora"
    >
      <RangeSelect value={days} onChange={setDays} />
      {error && !data ? (
        <ErrorState
          title="Couldn't load the overview"
          description={error.message}
          onRetry={() => void refetch()}
        />
      ) : isLoading || !data ? (
        <LoadingGrid />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Total users"
              value={data.kpis.totalUsers.toLocaleString()}
              hint={`${data.kpis.newUsers7d.toLocaleString()} new this week`}
              spark={data.series.newUsers.map((d) => d.count)}
            />
            <StatTile
              label="Paid users"
              value={data.kpis.paidUsers.toLocaleString()}
              hint={`${data.kpis.activeUsers.toLocaleString()} active subscriptions`}
            />
            <StatTile
              label="Tasks (all time)"
              value={compactNumber(data.kpis.totalTasks)}
              hint={`${data.kpis.tasks24h.toLocaleString()} in the last 24h`}
              spark={data.series.tasks.map((d) => d.count)}
            />
            <StatTile
              label="Credits consumed"
              value={compactNumber(data.kpis.creditsConsumed)}
              hint="All time"
              spark={data.series.credits.map((d) => d.count)}
            />
            <StatTile
              label="New users"
              value={data.kpis.newUsers30d.toLocaleString()}
              hint={`In the last ${days} days`}
            />
            <StatTile
              label="Completed tasks"
              value={compactNumber(data.kpis.completedTasks)}
              hint="All time"
            />
            <StatTile
              label="Failed tasks"
              value={compactNumber(data.kpis.failedTasks)}
              hint="All time"
            />
            <StatTile
              label="Connected accounts"
              value={data.kpis.connectedAccounts.toLocaleString()}
              hint="Social integrations"
            />
          </div>

          <PageSection
            title="Posts"
            description="Across all customers. Counts only, never which posts or whose."
          >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                label="Published"
                value={data.posts.published.toLocaleString()}
                hint={`${data.posts.publishedInRange.toLocaleString()} in the last ${days} days`}
                spark={data.posts.publishedSeries.map((d) => d.count)}
              />
              <StatTile
                label="Scheduled"
                value={data.posts.scheduled.toLocaleString()}
                hint={`${data.posts.scheduledNext7d.toLocaleString()} going out in the next 7 days`}
              />
              <StatTile
                label="Publishing now"
                value={data.posts.publishing.toLocaleString()}
                hint="Due now or being sent"
              />
              <StatTile
                label="Failed"
                value={data.posts.failed.toLocaleString()}
                hint={`${data.posts.failedInRange.toLocaleString()} in the last ${days} days`}
              />
            </div>
          </PageSection>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard
              title="Tasks per day"
              description={`Generations across all features, last ${days} days`}
            >
              <AreaChart
                data={data.series.tasks}
                series={[{ key: "count", label: "Tasks", color: "var(--chart-1)" }]}
              />
            </ChartCard>
            <ChartCard
              title="Sign-ups per day"
              description={`New accounts, last ${days} days`}
            >
              <AreaChart
                data={data.series.newUsers}
                series={[{ key: "count", label: "Sign-ups", color: "var(--chart-1)" }]}
              />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard title="Task status" description="All time">
              <DonutChart
                slices={data.taskStatus.map((s) => ({
                  label: titleCase(s.status.toLowerCase()),
                  value: s.count,
                  color: statusColor(s.status),
                }))}
              />
            </ChartCard>
            <ChartCard title="Feature usage" description="All time">
              <BarList
                items={data.kindCounts.map((k) => ({
                  label: kindLabel(k.kind),
                  value: k.count,
                }))}
              />
            </ChartCard>
            <ChartCard
              title="Connected platforms"
              description="All time"
            >
              <BarList
                items={data.providers.map((p) => ({
                  label: providerLabel(p.provider),
                  value: p.count,
                }))}
                emptyLabel="No connected accounts yet"
                scale="share"
              />
            </ChartCard>
          </div>

          <SignupBreakdown
            title="How users found us"
            description={`Answers to "How did you hear about Unsora?" from sign-ups in the last ${days} days`}
            column="Source"
            emptyLabel="Didn't answer"
            rows={data.sources?.map((s) => ({ ...s, label: s.source })) ?? null}
          />
          <SignupBreakdown
            title="Where users are"
            description={`Sign-ups in the last ${days} days by the country they sign in from`}
            column="Country"
            emptyLabel="Unknown"
            rows={data.countries?.map((c) => ({ ...c, label: c.country })) ?? null}
          />
        </div>
      )}
    </AdminPage>
  );
}

interface BreakdownRow {
  label: string;
  signups: number;
  startedPlan: number;
}

/**
 * The range's sign-ups split one way (onboarding answer, country), with how
 * many of each went on to start a plan or trial. `emptyLabel` is the row for
 * users with no value; it is shown muted.
 */
function SignupBreakdown({
  title,
  description,
  column,
  emptyLabel,
  rows,
}: {
  title: string;
  description: string;
  column: string;
  emptyLabel: string;
  rows: BreakdownRow[] | null;
}) {
  const total = rows?.reduce((sum, r) => sum + r.signups, 0) ?? 0;

  return (
    <PageSection title={title} description={description}>
      {!rows ? (
        <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          Couldn&apos;t load this from Clerk. Refresh to try again.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          No sign-ups in this range.
        </p>
      ) : (
        <TableShell>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <Th>{column}</Th>
              <Th className="text-right">Sign-ups</Th>
              <Th className="hidden md:table-cell">Share</Th>
              <Th className="text-right">Started a plan</Th>
              <Th className="text-right">Rate</Th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => {
              const share = total ? (s.signups / total) * 100 : 0;
              const rate = s.signups ? Math.round((s.startedPlan / s.signups) * 100) : 0;
              return (
                <TableRow key={s.label}>
                  <Td className={cn(s.label === emptyLabel && "text-muted-foreground")}>
                    {s.label}
                  </Td>
                  <Td className="text-right tabular-nums">{s.signups.toLocaleString()}</Td>
                  <Td className="hidden w-1/3 md:table-cell">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-input">
                        <span
                          className="block h-full rounded-full bg-chart-1"
                          style={{ width: `${Math.max(share, s.signups ? 2 : 0)}%` }}
                        />
                      </span>
                      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                        {Math.round(share)}%
                      </span>
                    </span>
                  </Td>
                  <Td
                    className={cn(
                      "text-right tabular-nums",
                      s.startedPlan === 0 && "text-muted-foreground",
                    )}
                  >
                    {s.startedPlan.toLocaleString()}
                  </Td>
                  <Td className="text-right tabular-nums">{rate}%</Td>
                </TableRow>
              );
            })}
          </TableBody>
        </TableShell>
      )}
    </PageSection>
  );
}

function LoadingGrid() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-26 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-75 rounded-xl" />
        <Skeleton className="h-75 rounded-xl" />
      </div>
    </div>
  );
}
