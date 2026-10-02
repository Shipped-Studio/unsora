import { cn } from "@/lib/utils";

export interface BarItem {
  label: string;
  value: number;
}

/**
 * Ranked horizontal bars for "which is biggest". One hue for every bar; the
 * label and value sit above the bar so they stay readable in both themes.
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
  const max = Math.max(...items.map((i) => i.value), 1);

  if (items.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {items.map((item, i) => {
        const pct = Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0);
        return (
          <li key={`${item.label}-${i}`} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{item.label}</span>
              <span className="shrink-0 font-medium tabular-nums">
                {valueFormat(item.value)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: "var(--chart-1)" }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
