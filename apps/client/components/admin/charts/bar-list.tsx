import { cn } from "@/lib/utils";

export interface BarItem {
  label: string;
  value: number;
}

/**
 * Ranked horizontal bars for "which is biggest". One hue for every bar; the
 * label and value sit above the bar so they stay readable in both themes.
 * Past `limit` rows, the remainder folds into a single "Other" row.
 *
 * `scale="max"` (default) sizes bars against the largest row, for rankings.
 * `scale="share"` sizes them against the total, so a list of near-equal
 * counts (say, one account per platform) doesn't render as all-full bars.
 */
export function BarList({
  items,
  valueFormat = (n) => n.toLocaleString(),
  emptyLabel = "No data yet",
  limit = 6,
  scale = "max",
  className,
}: {
  items: BarItem[];
  valueFormat?: (n: number) => string;
  emptyLabel?: string;
  /** Max rows shown, including the "Other" row. */
  limit?: number;
  scale?: "max" | "share";
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  const rows =
    items.length > limit
      ? [
          ...items.slice(0, limit - 1),
          {
            label: "Other",
            value: items
              .slice(limit - 1)
              .reduce((sum, item) => sum + item.value, 0),
          },
        ]
      : items;
  const max = Math.max(
    scale === "share"
      ? rows.reduce((sum, i) => sum + i.value, 0)
      : Math.max(...rows.map((i) => i.value)),
    1,
  );

  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {rows.map((item, i) => {
        const pct = Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0);
        return (
          <li key={`${item.label}-${i}`} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{item.label}</span>
              <span className="shrink-0 font-medium tabular-nums">
                {valueFormat(item.value)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-input">
              <div
                className="h-full rounded-full bg-chart-1"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
