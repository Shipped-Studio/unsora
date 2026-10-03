"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";

export interface TrendPoint {
  date: string;
  value: number;
}

const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 24, left: 44 };

function niceMax(max: number) {
  if (max <= 0) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const steps = [1, 2, 2.5, 5, 10];
  const step = steps.find((s) => s * magnitude >= max / 4) ?? 10;
  return Math.ceil(max / (step * magnitude)) * step * magnitude;
}

const compact = (n: number) =>
  new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** Single-series line chart with a hover crosshair. */
export function TrendChart({
  points,
  label,
}: {
  points: TrendPoint[];
  /** Series name, used in the tooltip and for screen readers. */
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const { path, area, xs, ys, ticks, yMax } = useMemo(() => {
    const innerW = Math.max(width - PAD.left - PAD.right, 10);
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const max = niceMax(Math.max(...points.map((p) => p.value), 0));
    const x = (i: number) =>
      PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
    const xs = points.map((_, i) => x(i));
    const ys = points.map((p) => y(p.value));
    const path = xs.map((px, i) => `${i ? "L" : "M"}${px.toFixed(1)},${ys[i].toFixed(1)}`).join("");
    const area = points.length
      ? `${path}L${xs[xs.length - 1].toFixed(1)},${y(0)}L${xs[0].toFixed(1)},${y(0)}Z`
      : "";
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ value: max * f, y: y(max * f) }));
    return { path, area, xs, ys, ticks, yMax: max };
  }, [points, width]);

  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(width / 90))));
  const active = hover !== null ? points[hover] : null;

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`${label} over time. Highest ${compact(Math.max(0, ...points.map((p) => p.value)))}.`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const mx = event.clientX - rect.left;
          let nearest = 0;
          xs.forEach((px, i) => {
            if (Math.abs(px - mx) < Math.abs(xs[nearest] - mx)) nearest = i;
          });
          setHover(points.length ? nearest : null);
        }}
        className="overflow-visible"
      >
        {ticks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={tick.y}
              y2={tick.y}
              className="stroke-border"
              strokeDasharray={tick.value === 0 ? undefined : "2 4"}
            />
            <text
              x={PAD.left - 8}
              y={tick.y}
              dy="0.32em"
              textAnchor="end"
              className="fill-muted-foreground text-2xs tabular-nums"
            >
              {compact(tick.value)}
            </text>
          </g>
        ))}

        {points.map((point, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text
              key={point.date}
              x={xs[i]}
              y={HEIGHT - 6}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              className="fill-muted-foreground text-2xs"
            >
              {format(new Date(point.date), "MMM d")}
            </text>
          ) : null,
        )}

        <path d={area} className="fill-chart-1" opacity={0.08} />
        <path
          d={path}
          fill="none"
          className="stroke-chart-1"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {hover !== null && points[hover] ? (
          <g>
            <line
              x1={xs[hover]}
              x2={xs[hover]}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              className="stroke-muted-foreground/40"
            />
            <circle
              cx={xs[hover]}
              cy={ys[hover]}
              r={4.5}
              className="fill-chart-1 stroke-card"
              strokeWidth={2}
            />
          </g>
        ) : null}
      </svg>

      {active && hover !== null ? (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: Math.min(Math.max(xs[hover] - 60, 0), Math.max(width - 130, 0)),
          }}
        >
          <p className="text-muted-foreground">{format(new Date(active.date), "EEE, MMM d")}</p>
          <p className="font-medium tabular-nums text-foreground">
            {active.value.toLocaleString()} {label.toLowerCase()}
          </p>
        </div>
      ) : null}
      <span className="sr-only">Scale up to {yMax.toLocaleString()}</span>
    </div>
  );
}
