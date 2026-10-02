"use client";

import { useMemo, useRef, useState } from "react";

interface TrendPoint {
  date: string;
  value: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  /** Formats a value for the tooltip and y-axis ticks. */
  formatValue: (value: number) => string;
}

const W = 640;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 24, left: 44 };

/** Round a max up to a clean axis number (1/2/5 × 10^n). */
function niceMax(max: number): number {
  if (max <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 2, 5, 10]) {
    if (max <= m * pow) return m * pow;
  }
  return 10 * pow;
}

function formatTickDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Single-series trend line: 2px line, 10% area wash, hairline grid,
 * crosshair + tooltip on hover. Series color is the theme primary; all
 * text stays in text tokens.
 */
export function TrendChart({ data, formatValue }: TrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { points, yMax, ticks } = useMemo(() => {
    const yMax = niceMax(Math.max(...data.map((d) => d.value), 0));
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const step = data.length > 1 ? innerW / (data.length - 1) : 0;

    const points = data.map((d, i) => ({
      ...d,
      x: PAD.left + (data.length > 1 ? i * step : innerW / 2),
      y: PAD.top + innerH - (d.value / yMax) * innerH,
    }));

    const ticks = [0, 0.5, 1].map((f) => ({
      value: yMax * f,
      y: PAD.top + innerH - f * innerH,
    }));

    return { points, yMax, ticks };
  }, [data]);

  if (data.length === 0) return null;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${H - PAD.bottom} L${points[0].x},${H - PAD.bottom} Z`;

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let best = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - x);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  };

  const hover = hoverIndex !== null ? points[hoverIndex] : null;

  // Tooltip position as a percentage of the rendered width/height.
  const tooltipLeft = hover ? (hover.x / W) * 100 : 0;
  const tooltipTop = hover ? (hover.y / H) * 100 : 0;

  const xLabelIndexes =
    data.length <= 2
      ? data.map((_, i) => i)
      : [0, Math.floor((data.length - 1) / 2), data.length - 1];

  return (
    <div ref={containerRef} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full text-primary"
        role="img"
        aria-label="Trend over time"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {/* Hairline grid + y ticks */}
        {ticks.map((t) => (
          <g key={t.value}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={t.y}
              y2={t.y}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={t.y + 3.5}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize={11}
            >
              {formatValue(t.value)}
            </text>
          </g>
        ))}

        {/* X labels: first, middle, last */}
        {xLabelIndexes.map((i) => (
          <text
            key={i}
            x={points[i].x}
            y={H - 6}
            textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
            className="fill-muted-foreground"
            fontSize={11}
          >
            {formatTickDate(points[i].date)}
          </text>
        ))}

        {/* Area wash + line */}
        <path d={areaPath} fill="currentColor" opacity={0.1} />
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Crosshair + hover marker */}
        {hover && (
          <g>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={PAD.top}
              y2={H - PAD.bottom}
              className="stroke-muted-foreground/40"
              strokeWidth={1}
            />
            {/* 2px surface ring keeps the dot legible on the line */}
            <circle
              cx={hover.x}
              cy={hover.y}
              r={6}
              className="fill-background"
            />
            <circle cx={hover.x} cy={hover.y} r={4} fill="currentColor" />
          </g>
        )}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: `${Math.min(90, Math.max(10, tooltipLeft))}%`,
            top: `calc(${tooltipTop}% - 10px)`,
          }}
        >
          <div className="text-muted-foreground">
            {formatTickDate(hover.date)}
          </div>
          <div className="font-semibold tabular-nums text-foreground">
            {formatValue(hover.value)}
          </div>
        </div>
      )}
    </div>
  );
}
