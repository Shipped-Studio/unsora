"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** Day-range picker for the time-series views. */
export function RangeSelect({
  value,
  onChange,
  options = [7, 14, 30, 60, 90],
}: {
  value: number;
  onChange: (days: number) => void;
  options?: number[];
}) {
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      aria-label="Date range"
      value={[String(value)]}
      onValueChange={(next) => {
        const days = Number(next[0]);
        if (days) onChange(days);
      }}
    >
      {options.map((days) => (
        <ToggleGroupItem
          key={days}
          value={String(days)}
          aria-label={`Last ${days} days`}
          className="tabular-nums"
        >
          {days}d
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
