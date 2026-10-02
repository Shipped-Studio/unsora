"use client";

import { useState } from "react";
import { PageHeader, RangeSelect } from "@/components/admin/page-header";
import {
  ChartCard,
  BarList,
  DonutChart,
  AreaChart,
  useChartTheme,
  kindLabel,
} from "@/components/admin/charts";
import { TableShell, Th, Td, Tr } from "@/components/admin/data-table";
import { useAdminAnalytics } from "@/hooks/admin/use-admin-data";
import { compactNumber, titleCase } from "@/lib/admin-format";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useAdminAnalytics(days);
  const theme = useChartTheme();

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Which features are used, how well they complete, and what they cost."
        actions={<RangeSelect value={days} onChange={setDays} />}
      />

      {isLoading || !data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[320px] rounded-xl" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      ) : (
        <AnalyticsBody data={data} days={days} theme={theme} />
      )}
    </div>
  );
}

function AnalyticsBody({
  data,
  days,
  theme,
}: {
  data: NonNullable<ReturnType<typeof useAdminAnalytics>["data"]>;
  days: number;
  theme: ReturnType<typeof useChartTheme>;
}) {
  // Top features drive the stacked series; the rest are omitted from the chart
  // (still counted in the table below) to keep the palette legible.
  const topKinds = data.byKind.slice(0, 6);
  const series = topKinds.map((k, i) => ({
    key: k.kind,
    label: kindLabel(k.kind),
    color: theme.cat(i),
  }));

  const maxCredits = Math.max(...data.byKind.map((k) => k.credits), 1);

  return (
    <div className="flex flex-col gap-4">
      <ChartCard
        title="Feature activity over time"
        description={`Tasks per day by feature (top ${topKinds.length}) · last ${days} days`}
      >
        <AreaChart data={data.seriesByKind} series={series} stacked height={280} />
        <Legend series={series} />
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Task status" description="All-time outcome split">
          <DonutChart
            slices={data.statusTotals.map((s) => ({
              label: titleCase(s.status),
              value: s.count,
              color: theme.statusColor(s.status),
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Credits by feature"
          description="Where credits are spent"
        >
          <BarList
            items={data.byKind
              .filter((k) => k.credits > 0)
              .map((k) => ({
                label: kindLabel(k.kind),
                value: k.credits,
              }))}
            valueFormat={(n) => compactNumber(n)}
            emptyLabel="No credits consumed yet"
          />
        </ChartCard>

        <ChartCard title="Top models" description="Most-used models">
          <BarList
            items={data.topModels.map((m, i) => ({
              label: m.model,
              value: m.count,
              color: theme.cat(i % 8),
            }))}
            emptyLabel="No model data yet"
          />
        </ChartCard>
      </div>

      {/* Per-feature breakdown */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Feature breakdown</h3>
        <TableShell>
          <thead>
            <tr>
              <Th>Feature</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-right">Done</Th>
              <Th className="text-right">Failed</Th>
              <Th>Success rate</Th>
              <Th className="text-right">Credits</Th>
            </tr>
          </thead>
          <tbody>
            {data.byKind.map((k, i) => (
              <Tr key={k.kind}>
                <Td className="whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: theme.cat(i % 8) }}
                    />
                    {kindLabel(k.kind)}
                  </span>
                </Td>
                <Td className="text-right tabular-nums font-medium">
                  {k.total.toLocaleString()}
                </Td>
                <Td className="text-right tabular-nums text-muted-foreground">
                  {k.completed.toLocaleString()}
                </Td>
                <Td className="text-right tabular-nums text-muted-foreground">
                  {k.failed.toLocaleString()}
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${k.successRate}%`,
                          backgroundColor:
                            k.successRate >= 80
                              ? theme.status.good
                              : k.successRate >= 50
                                ? theme.status.warning
                                : theme.status.critical,
                        }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {k.successRate}%
                    </span>
                  </div>
                </Td>
                <Td className="text-right tabular-nums">
                  {compactNumber(k.credits)}
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableShell>
      </div>
    </div>
  );
}

function Legend({
  series,
}: {
  series: { key: string; label: string; color: string }[];
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5 text-xs">
          <span
            className="size-2.5 rounded-[3px]"
            style={{ backgroundColor: s.color }}
          />
          <span className="text-muted-foreground">{s.label}</span>
        </span>
      ))}
    </div>
  );
}
