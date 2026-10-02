"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Segmented day-range control used by the time-series views. */
export function RangeSelect({
  value,
  onChange,
  options = [7, 14, 30, 60, 90],
}: {
  value: number;
  onChange: (v: number) => void;
  options?: number[];
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
            value === opt
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt}d
        </button>
      ))}
    </div>
  );
}
