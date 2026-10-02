"use client";

import { cn } from "@/lib/utils";
import { useChartTheme } from "./palette";
import type { ReactNode } from "react";

export interface BarItem {
  label: string;
  value: number;
  /** Optional explicit color (else the sequential magnitude hue). */
  color?: string;
  /** Optional secondary text shown right-aligned before the value. */
  meta?: ReactNode;
  /** Optional href-like click handler. */
  onClick?: () => void;
}

/**
 * Ranked horizontal bars — the right form for "which is biggest" (magnitude).
 * Single sequential hue by default; bars carry an in-row label so identity is
 * never color-alone. The value is direct-labeled at the end of each row.
 */
export function BarList({
  items,
  valueFormat = (n) => n.toLocaleString(),
  emptyLabel = "No data yet",
  className,
}: {
  items: BarItem[];
  valueFormat?: (n: number) => string;
  emptyLabel?: string;
  className?: string;
}) {
  const theme = useChartTheme();
  const max = Math.max(...items.map((i) => i.value), 1);

  if (items.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {items.map((item, i) => {
        const pct = Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0);
        const color = item.color ?? theme.sequential;
        return (
          <div
            key={`${item.label}-${i}`}
            className={cn(
              "group grid grid-cols-[1fr_auto] items-center gap-3",
              item.onClick && "cursor-pointer",
            )}
            onClick={item.onClick}
          >
            <div className="relative min-w-0">
              <div className="relative h-7 w-full overflow-hidden rounded-md bg-muted/60">
                <div
                  className="absolute inset-y-0 left-0 rounded-md transition-[width] duration-500 group-hover:brightness-95"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: color,
                    opacity: theme.isDark ? 0.85 : 0.9,
                  }}
                />
                <span className="absolute inset-y-0 left-2.5 flex items-center truncate pr-2 text-xs font-medium text-foreground mix-blend-normal">
                  {item.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 tabular-nums">
              {item.meta && (
                <span className="text-xs text-muted-foreground">
                  {item.meta}
                </span>
              )}
              <span className="text-sm font-semibold text-foreground">
                {valueFormat(item.value)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
