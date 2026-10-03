"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/**
 * Donut for part-to-whole (e.g. task status split). The center shows the
 * total; the legend is always present so identity is never color alone.
 * Hovering a slice or legend row highlights the pair.
 */
export function DonutChart({
  slices,
  centerLabel = "total",
  size = 168,
  className,
}: {
  slices: DonutSlice[];
  centerLabel?: string;
  size?: number;
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);

  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const gap = 2; // px surface gap between arcs

  let offset = 0;
  const arcs = slices.map((slice, i) => {
    const frac = total > 0 ? slice.value / total : 0;
    // Keep tiny non-zero slices visible as a sliver.
    const len = slice.value > 0 ? Math.max(frac * circ - gap, 1.5) : 0;
    const arc = {
      slice,
      i,
      dasharray: `${len} ${circ - len}`,
      dashoffset: -offset,
    };
    offset += frac * circ;
    return arc;
  });

  return (
    <div className={cn("flex flex-col items-center gap-4 sm:flex-row", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            className="stroke-input"
            strokeWidth={stroke}
          />
          {total > 0 &&
            arcs.map((a) => (
              <circle
                key={a.i}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                style={{ stroke: a.slice.color }}
                strokeWidth={stroke}
                strokeDasharray={a.dasharray}
                strokeDashoffset={a.dashoffset}
                strokeLinecap="butt"
                className="transition-opacity duration-200"
                opacity={active === null || active === a.i ? 1 : 0.3}
                onMouseEnter={() => setActive(a.i)}
                onMouseLeave={() => setActive(null)}
              />
            ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
            {(active !== null ? slices[active].value : total).toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">
            {active !== null ? slices[active].label : centerLabel}
          </span>
        </div>
      </div>

      <div className="flex w-full flex-col gap-1.5">
        {slices.map((slice, i) => {
          const raw = total > 0 ? (slice.value / total) * 100 : 0;
          const pct =
            raw > 0 && Math.round(raw) === 0 ? "<1%" : `${Math.round(raw)}%`;
          return (
            <div
              key={slice.label}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <span
                className="size-2.5 shrink-0 rounded-xs"
                style={{ backgroundColor: slice.color }}
              />
              <span className="flex-1 truncate text-xs text-foreground">
                {slice.label}
              </span>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {slice.value.toLocaleString()}
              </span>
              <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                {pct}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
