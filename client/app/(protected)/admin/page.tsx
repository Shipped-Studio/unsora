"use client";

import { useState } from "react";
import {
  Users,
  Lightning,
  Sparkle,
  CheckCircle,
  XCircle,
  ShareNetwork,
  Stack,
  UserPlus,
} from "@phosphor-icons/react";
import { PageHeader, RangeSelect } from "@/components/admin/page-header";
import {
  ChartCard,
  StatTile,
  BarList,
  DonutChart,
  AreaChart,
  useChartTheme,
  kindLabel,
} from "@/components/admin/charts";
import { useAdminOverview } from "@/hooks/admin/use-admin-data";
import { compactNumber, titleCase } from "@/lib/admin-format";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminOverviewPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useAdminOverview(days);
  const theme = useChartTheme();

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Everything happening across Unsora at a glance."
        actions={<RangeSelect value={days} onChange={setDays} />}
      />

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load overview. {(error as Error).message}
        </div>
      )}

      {isLoading || !data ? (
        <LoadingGrid />
      ) : (
        <div className="flex flex-col gap-4">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Total users"
              value={data.kpis.totalUsers.toLocaleString()}
              hint={`${data.kpis.newUsers7d.toLocaleString()} new this week`}
              icon={Users}
              spark={data.series.newUsers.map((d) => d.count)}
            />
            <StatTile
              label="Paid users"
              value={data.kpis.paidUsers.toLocaleString()}
              hint={`${data.kpis.activeUsers.toLocaleString()} active subscriptions`}
              icon={Lightning}
              accent="good"
            />
            <StatTile
              label="Tasks (all time)"
              value={compactNumber(data.kpis.totalTasks)}
              hint={`${data.kpis.tasks24h.toLocaleString()} in last 24h`}
              icon={Stack}
              spark={data.series.tasks.map((d) => d.count)}
            />
            <StatTile
              label="Credits consumed"
              value={compactNumber(data.kpis.creditsConsumed)}
              hint={`over the selected range`}
              icon={Sparkle}
              accent="warning"
              spark={data.series.credits.map((d) => d.count)}
            />
            <StatTile
              label="New users"
              value={data.kpis.newUsers30d.toLocaleString()}
              hint={`in the last ${days} days`}
              icon={UserPlus}
            />
            <StatTile
              label="Completed"
              value={compactNumber(data.kpis.completedTasks)}
              hint="successful generations"
              icon={CheckCircle}
              accent="good"
            />
            <StatTile
              label="Failed"
              value={compactNumber(data.kpis.failedTasks)}
              hint="need attention"
              icon={XCircle}
              accent="critical"
            />
            <StatTile
              label="Connected accounts"
              value={data.kpis.connectedAccounts.toLocaleString()}
              hint="social integrations"
              icon={ShareNetwork}
            />
          </div>

          {/* Time series */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard
              title="Tasks per day"
              description={`Generations across all features · last ${days} days`}
            >
              <AreaChart
                data={data.series.tasks}
                series={[
                  { key: "count", label: "Tasks", color: theme.sequential },
                ]}
              />
            </ChartCard>
            <ChartCard
              title="New sign-ups per day"
              description={`New accounts · last ${days} days`}
            >
              <AreaChart
                data={data.series.newUsers}
                series={[
                  { key: "count", label: "Sign-ups", color: theme.cat(1) },
                ]}
              />
            </ChartCard>
          </div>

          {/* Distributions */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard title="Task status" className="lg:col-span-1">
              <DonutChart
                slices={data.taskStatus.map((s) => ({
                  label: titleCase(s.status),
                  value: s.count,
                  color: theme.statusColor(s.status),
                }))}
              />
            </ChartCard>
            <ChartCard
              title="Feature usage"
              description="Tasks by feature"
              className="lg:col-span-1"
            >
              <BarList
                items={data.kindCounts.map((k) => ({
                  label: kindLabel(k.kind),
                  value: k.count,
                }))}
              />
            </ChartCard>
            <ChartCard
              title="Connected platforms"
              description="Linked social accounts"
              className="lg:col-span-1"
            >
              <BarList
                items={data.providers.map((p, i) => ({
                  label: titleCase(p.provider),
                  value: p.count,
                  color: theme.cat(i),
                }))}
                emptyLabel="No connected accounts yet"
              />
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    </div>
  );
}
