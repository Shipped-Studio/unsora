"use client";

import { useState } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import {
  AreaChart,
  BarList,
  ChartCard,
  DonutChart,
  MAX_SERIES,
  chartColor,
  kindLabel,
  statusColor,
} from "@/components/admin/charts";
import { TableShell, Td, Th } from "@/components/admin/data-table";
import { RangeSelect } from "@/components/admin/range-select";
import { PageSection } from "@/components/layout/page-header";
import { ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminAnalytics } from "@/hooks/admin/use-admin-data";
import type { AdminAnalyticsData } from "@/hooks/admin/types";
import { compactNumber, titleCase } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error, refetch } = useAdminAnalytics(days);

  return (
    <AdminPage
      title="Analytics"
      description="Feature usage, completion rates and credit spend"
    >
      <RangeSelect value={days} onChange={setDays} />
      {error && !data ? (
        <ErrorState
          title="Couldn't load analytics"
          description={error.message}
          onRetry={() => void refetch()}
        />
      ) : isLoading || !data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-80 rounded-xl" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      ) : (
        <AnalyticsBody data={data} days={days} />
      )}
    </AdminPage>
  );
}

function successTone(rate: number) {
  if (rate >= 80) return "bg-success";
  if (rate >= 50) return "bg-warning";
  return "bg-destructive";
}

function AnalyticsBody({ data, days }: { data: AdminAnalyticsData; days: number }) {
  // The top features get a series each; the rest stay in the table below so
  // the chart never repeats a hue.
  const topKinds = data.byKind.slice(0, MAX_SERIES);
  const series = topKinds.map((k, i) => ({
    key: k.kind,
    label: kindLabel(k.kind),
    color: chartColor(i),
  }));
  const seriesColor = new Map(series.map((s) => [s.key, s.color]));

  return (
    <div className="flex flex-col gap-4">
      <ChartCard
        title="Feature activity over time"
        description={`Tasks per day for the top ${topKinds.length} features, last ${days} days`}
      >
        <AreaChart data={data.seriesByKind} series={series} stacked height={280} />
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5 text-xs">
              <span
                className="size-2.5 rounded-xs"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-muted-foreground">{s.label}</span>
            </li>
          ))}
        </ul>
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Task status" description="All-time outcome split">
          <DonutChart
            slices={data.statusTotals.map((s) => ({
              label: titleCase(s.status.toLowerCase()),
              value: s.count,
              color: statusColor(s.status),
            }))}
          />
        </ChartCard>

        <ChartCard title="Credits by feature" description="Where credits are spent">
          <BarList
            items={data.byKind
              .filter((k) => k.credits > 0)
              .map((k) => ({ label: kindLabel(k.kind), value: k.credits }))}
            valueFormat={(n) => compactNumber(n)}
            emptyLabel="No credits consumed yet"
          />
        </ChartCard>

        <ChartCard title="Top models" description="Most-used models">
          <BarList
            items={data.topModels.map((m) => ({ label: m.model, value: m.count }))}
            emptyLabel="No model data yet"
          />
        </ChartCard>
      </div>

      <PageSection title="Feature breakdown">
        <TableShell>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <Th>Feature</Th>
              <Th className="text-right">Total</Th>
              <Th className="hidden text-right md:table-cell">Done</Th>
              <Th className="hidden text-right md:table-cell">Failed</Th>
              <Th>Success rate</Th>
              <Th className="text-right">Credits</Th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.byKind.map((k) => {
              const color = seriesColor.get(k.kind);
              return (
                <TableRow key={k.kind}>
                  <Td>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn("size-2.5 shrink-0 rounded-xs", !color && "bg-input")}
                        style={color ? { backgroundColor: color } : undefined}
                      />
                      {kindLabel(k.kind)}
                    </span>
                  </Td>
                  <Td className="text-right font-medium tabular-nums">
                    {k.total.toLocaleString()}
                  </Td>
                  <Td className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
                    {k.completed.toLocaleString()}
                  </Td>
                  <Td className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
                    {k.failed.toLocaleString()}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-input sm:block">
                        <div
                          className={cn("h-full rounded-full", successTone(k.successRate))}
                          style={{ width: `${k.successRate}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {k.successRate}%
                      </span>
                    </div>
                  </Td>
                  <Td
                    className={cn(
                      "text-right tabular-nums",
                      k.credits === 0 && "text-muted-foreground",
                    )}
                  >
                    {k.credits.toLocaleString()}
                  </Td>
                </TableRow>
              );
            })}
          </TableBody>
        </TableShell>
      </PageSection>
    </div>
  );
}
