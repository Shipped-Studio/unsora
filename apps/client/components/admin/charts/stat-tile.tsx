import { Card, CardContent } from "@/components/ui/card";
import type { ReactNode } from "react";

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Optional sparkline (array of daily values). */
  spark?: number[];
  className?: string;
}

/**
 * A single KPI. The number is the visualization; the sparkline is a glance,
 * so it carries no axis or legend.
 */
export function StatTile({ label, value, hint, spark, className }: StatTileProps) {
  return (
    <Card size="sm" className={className}>
      <CardContent className="gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-2xl font-medium tabular-nums">
              {value}
            </div>
            {hint ? (
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {hint}
              </div>
            ) : null}
          </div>
          {spark && spark.length > 1 ? <Sparkline values={spark} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 72;
  const h = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return [x, y] as const;
  });
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0 overflow-visible"
      aria-hidden
    >
      <polyline
        points={points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
        fill="none"
        style={{ stroke: "var(--chart-1)" }}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={2.5} style={{ fill: "var(--chart-1)" }} />
    </svg>
  );
}
