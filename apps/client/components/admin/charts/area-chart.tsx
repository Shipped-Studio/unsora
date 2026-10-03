"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { format, isValid, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

export interface AreaSeries {
  key: string;
  label: string;
  color: string;
}

function val(row: object, key: string): number {
  return Number((row as Record<string, unknown>)[key]) || 0;
}

/**
 * A round axis maximum and its integer tick step (same idea as niceMax in
 * components/scheduler/trend-chart.tsx). Counts are whole numbers, so the
 * step never drops below 1 and the labels never repeat.
 */
function niceScale(max: number): { max: number; step: number } {
  if (max <= 0) return { max: 4, step: 1 };
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const steps = [1, 2, 2.5, 5, 10];
  let step = (steps.find((s) => s * magnitude >= rough) ?? 10) * magnitude;
  // 2.5 × 1 (or smaller) is not a whole number; take the next round step.
  if (!Number.isInteger(step)) step = step < 1 ? 1 : Math.ceil(step / 5) * 5;
  return { max: Math.ceil(max / step) * step, step };
}

const compactAxis = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

function parseDay(d: string): Date | null {
  const date = parseISO(d);
  return isValid(date) ? date : null;
}

/** "Sep 4" for axis labels. */
function axisDate(d: string): string {
  const date = parseDay(d);
  return date ? format(date, "MMM d") : d;
}

/** "Thu, Sep 4" for the tooltip. */
function tooltipDate(d: string): string {
  const date = parseDay(d);
  return date ? format(date, "EEE, MMM d") : d;
}

/** Minimum horizontal room for one "MMM d" label. */
const X_LABEL_GAP = 64;

/**
 * Time-series line/area chart with a crosshair and tooltip. One or several
 * series, optionally stacked. Series colors are CSS values (chart tokens).
 *
 * Generic over the row shape so callers can pass typed arrays
 * (e.g. `{ date, count }[]`); series keys index into each row.
 */
export function AreaChart<T extends { date: string }>({
  data,
  series,
  height = 240,
  stacked = false,
  valueFormat = (n) => n.toLocaleString(),
  className,
}: {
  data: readonly T[];
  series: AreaSeries[];
  height?: number;
  stacked?: boolean;
  valueFormat?: (n: number) => string;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const padL = 40;
  const padR = 12;
  const padT = 10;
  const padB = 22;
  const innerW = Math.max(width - padL - padR, 10);
  const innerH = Math.max(height - padT - padB, 10);
  const n = data.length;

  // Data max — for stacked, the max column total; else the max single value.
  const dataMax = useMemo(() => {
    let m = 0;
    for (const row of data) {
      if (stacked) {
        const sum = series.reduce((s, ser) => s + val(row, ser.key), 0);
        m = Math.max(m, sum);
      } else {
        for (const ser of series) m = Math.max(m, val(row, ser.key));
      }
    }
    return m;
  }, [data, series, stacked]);
  const { max: maxY, step: tickStep } = useMemo(
    () => niceScale(dataMax),
    [dataMax],
  );

  const x = useCallback(
    (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW),
    [n, innerW],
  );
  const y = useCallback(
    (v: number) => padT + innerH - (v / maxY) * innerH,
    [innerH, maxY],
  );

  // Build cumulative stacks so stacked areas don't overlap.
  const stackTops = useMemo(() => {
    const tops: number[][] = data.map(() => []);
    data.forEach((row, ri) => {
      let acc = 0;
      series.forEach((ser) => {
        acc += val(row, ser.key);
        tops[ri].push(acc);
      });
    });
    return tops;
  }, [data, series]);

  const linePath = (ser: AreaSeries, si: number) =>
    data
      .map((row, i) => {
        const v = stacked ? stackTops[i][si] : val(row, ser.key);
        return `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      })
      .join(" ");

  const areaPath = (ser: AreaSeries, si: number) => {
    const top = data
      .map((row, i) => {
        const v = stacked ? stackTops[i][si] : val(row, ser.key);
        return `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      })
      .join(" ");
    if (stacked && si > 0) {
      const bottom = data
        .map((row, i) => {
          const v = stackTops[i][si - 1];
          return `L${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        })
        .reverse()
        .join(" ");
      return `${top} ${bottom} Z`;
    }
    return `${top} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(
      1,
    )},${y(0).toFixed(1)} Z`;
  };

  // Y ticks: whole-number steps from 0 to the nice max.
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = 0; t <= maxY + tickStep / 2; t += tickStep) out.push(t);
    return out;
  }, [maxY, tickStep]);

  // Sparse x labels: as many as fit, then the last day only if it has room.
  const labelEvery = Math.max(
    1,
    Math.ceil(n / Math.max(2, Math.floor(innerW / X_LABEL_GAP))),
  );
  const lastRegular = n > 0 ? Math.floor((n - 1) / labelEvery) * labelEvery : 0;
  const showLast =
    n > 1 &&
    lastRegular !== n - 1 &&
    x(n - 1) - x(lastRegular) >= X_LABEL_GAP;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = e.clientX - rect.left;
    const i = Math.round((rel / innerW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const hoverRow = hover !== null ? data[hover] : null;
  const empty = n === 0 || dataMax === 0;

  // Empty: a compact message (same height as BarList's) rather than a full
  // chart-height blank card.
  if (empty) {
    return (
      <div
        ref={wrapRef}
        className={cn(
          "flex h-24 w-full items-center justify-center text-sm text-muted-foreground",
          className,
        )}
      >
        No data in this range
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={cn("relative w-full", className)}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${series.map((s) => s.label).join(", ")} per day. Highest ${valueFormat(dataMax)}.`}
        className="overflow-visible"
      >
        {/* gridlines + y labels */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={width - padR}
              y1={y(t)}
              y2={y(t)}
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray={t === 0 ? undefined : "2 4"}
            />
            <text
              x={padL - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              className="fill-muted-foreground text-2xs tabular-nums"
            >
              {compactAxis.format(t)}
            </text>
          </g>
        ))}

        {/* areas (render back-to-front for stacked) */}
        {series.map((ser, si) => (
          <path
            key={`a-${ser.key}`}
            d={areaPath(ser, si)}
            style={{ fill: ser.color }}
            opacity={stacked ? 0.5 : 0.12}
          />
        ))}
        {/* lines */}
        {series.map((ser, si) => (
          <path
            key={`l-${ser.key}`}
            d={linePath(ser, si)}
            fill="none"
            style={{ stroke: ser.color }}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* x labels */}
        {data.map((row, i) =>
          i % labelEvery === 0 || (i === n - 1 && showLast) ? (
            <text
              key={`x-${i}`}
              x={x(i)}
              y={height - 6}
              textAnchor={
                n > 1 && i === 0 ? "start" : n > 1 && i === n - 1 ? "end" : "middle"
              }
              className="fill-muted-foreground text-2xs tabular-nums"
            >
              {axisDate(row.date)}
            </text>
          ) : null,
        )}

        {/* crosshair + markers */}
        {hover !== null && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={padT}
              y2={padT + innerH}
              className="stroke-muted-foreground/40"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            {series.map((ser, si) => {
              const v = stacked
                ? stackTops[hover][si]
                : val(data[hover], ser.key);
              return (
                <circle
                  key={`m-${ser.key}`}
                  cx={x(hover)}
                  cy={y(v)}
                  r={4}
                  className="stroke-card"
                  style={{ fill: ser.color }}
                  strokeWidth={2}
                />
              );
            })}
          </>
        )}

        {/* interaction surface */}
        <rect
          x={padL}
          y={padT}
          width={innerW}
          height={innerH}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>

      {hoverRow && (
        <Tooltip
          x={x(hover!)}
          width={width}
          date={tooltipDate(hoverRow.date)}
          rows={series.map((ser) => ({
            label: ser.label,
            color: ser.color,
            value: valueFormat(val(hoverRow, ser.key)),
          }))}
        />
      )}
    </div>
  );
}

function Tooltip({
  x,
  width,
  date,
  rows,
}: {
  x: number;
  width: number;
  date: string;
  rows: { label: string; color: string; value: string }[];
}) {
  // Flip the tooltip to keep it inside the chart.
  const flip = x > width - 160;
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 min-w-32 rounded-lg border bg-popover p-2 text-xs text-popover-foreground shadow-md"
      style={{
        left: flip ? undefined : Math.min(x + 10, width - 140),
        right: flip ? Math.max(width - x + 10, 8) : undefined,
      }}
    >
      <div className="mb-1 font-medium text-foreground">{date}</div>
      <div className="flex flex-col gap-0.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-xs"
              style={{ backgroundColor: r.color }}
            />
            <span className="flex-1 truncate text-muted-foreground">
              {r.label}
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
