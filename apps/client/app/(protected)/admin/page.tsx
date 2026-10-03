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
import { ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminOverview } from "@/hooks/admin/use-admin-data";
import { compactNumber, providerLabel, titleCase } from "@/lib/admin-format";

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
        </div>
      )}
    </AdminPage>
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
