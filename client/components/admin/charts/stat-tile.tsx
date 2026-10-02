"use client";

import { cn } from "@/lib/utils";
import type { ComponentType, ReactNode } from "react";
import type { IconProps } from "@phosphor-icons/react";
import { useChartTheme } from "./palette";

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<IconProps>;
  /** Optional tiny sparkline (array of daily values). */
  spark?: number[];
  accent?: "default" | "good" | "critical" | "warning";
  className?: string;
}

/**
 * A single KPI. A number *is* the visualization here — the optional sparkline
 * is a supporting glance, not a full chart, so it carries no axis or legend.
 */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  spark,
  accent = "default",
  className,
}: StatTileProps) {
  const theme = useChartTheme();

  const accentColor =
    accent === "good"
      ? theme.status.good
      : accent === "critical"
        ? theme.status.critical
        : accent === "warning"
          ? theme.status.warning
          : theme.sequential;

  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <Icon
            weight="fill"
            className="size-4 shrink-0"
            style={{ color: accentColor }}
          />
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-2xl font-semibold tabular-nums text-foreground">
            {value}
          </div>
          {hint && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {hint}
            </div>
          )}
        </div>
        {spark && spark.length > 1 && (
          <Sparkline values={spark} color={accentColor} />
        )}
      </div>
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 72;
  const h = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = pts[pts.length - 1].split(",");

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0 overflow-visible"
      aria-hidden
    >
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </svg>
  );
}
