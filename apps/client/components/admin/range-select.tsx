"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Day-range picker for the time-series views. */
export function RangeSelect({
  value,
  onChange,
  options = [7, 30, 90],
  className,
}: {
  value: number;
  onChange: (days: number) => void;
  options?: number[];
  className?: string;
}) {
  return (
    <Tabs
      value={String(value)}
      onValueChange={(next) => {
        const days = Number(next);
        if (days) onChange(days);
      }}
      className={className}
    >
      <TabsList aria-label="Date range">
        {options.map((days) => (
          <TabsTrigger key={days} value={String(days)} className="tabular-nums">
            {days} days
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
