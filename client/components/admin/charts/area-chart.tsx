"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { useChartTheme } from "./palette";

export interface AreaSeries {
  key: string;
  label: string;
  color: string;
}

/**
 * Time-series line/area chart with a crosshair + tooltip (an HTML/SVG chart is
 * interactive by default). Supports one or several series, optionally stacked.
 * Recessive gridlines, 2px lines, ≥8px hover markers, a legend for ≥2 series.
 *
 * Generic over the row shape so callers can pass strongly-typed arrays
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
  const val = (row: T, key: string): number =>
    Number((row as Record<string, unknown>)[key]) || 0;
  const theme = useChartTheme();
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

  // Y max — for stacked, the max column total; else the max single value.
  const maxY = useMemo(() => {
    let m = 0;
    for (const row of data) {
      if (stacked) {
        const sum = series.reduce((s, ser) => s + val(row, ser.key), 0);
        m = Math.max(m, sum);
      } else {
        for (const ser of series) m = Math.max(m, val(row, ser.key));
      }
    }
    return m || 1;
  }, [data, series, stacked]);

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

  // Y ticks (4 bands).
  const ticks = useMemo(() => {
    const count = 4;
    return Array.from({ length: count + 1 }, (_, i) => (maxY / count) * i);
  }, [maxY]);

  // Sparse x labels.
  const labelEvery = Math.max(1, Math.ceil(n / 7));

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = e.clientX - rect.left - padL;
    const i = Math.round((rel / innerW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const fmtDate = (d: string) => {
    const parts = d.split("-");
    return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d;
  };

  const hoverRow = hover !== null ? data[hover] : null;

  return (
    <div ref={wrapRef} className={cn("relative w-full", className)}>
      <svg width={width} height={height} className="overflow-visible">
        {/* gridlines + y labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={width - padR}
              y1={y(t)}
              y2={y(t)}
              stroke={theme.grid}
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill={theme.muted}
            >
              {valueFormat(Math.round(t))}
            </text>
          </g>
        ))}

        {/* areas (render back-to-front for stacked) */}
        {series.map((ser, si) => (
          <path
            key={`a-${ser.key}`}
            d={areaPath(ser, si)}
            fill={ser.color}
            opacity={stacked ? (theme.isDark ? 0.55 : 0.5) : 0.12}
          />
        ))}
        {/* lines */}
        {series.map((ser, si) => (
          <path
            key={`l-${ser.key}`}
            d={linePath(ser, si)}
            fill="none"
            stroke={ser.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* x labels */}
        {data.map((row, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text
              key={`x-${i}`}
              x={x(i)}
              y={height - 6}
              textAnchor="middle"
              fontSize={10}
              fill={theme.muted}
            >
              {fmtDate(row.date)}
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
              stroke={theme.axis}
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
                  fill={ser.color}
                  stroke={theme.surface}
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
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>

      {hoverRow && (
        <Tooltip
          x={x(hover!)}
          width={width}
          date={fmtDate(hoverRow.date)}
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
      className="pointer-events-none absolute top-2 z-10 min-w-[120px] rounded-lg border border-border bg-popover p-2 text-xs shadow-md"
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
              className="size-2 shrink-0 rounded-[2px]"
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
