"use client";

import { useMemo } from "react";
import { Clock } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TimezoneCombobox } from "@/components/scheduler/timezone-combobox";
import { useNextSlots, useWeekStartsOn } from "@/hooks/use-schedule";
import { formatDayTime } from "@/lib/scheduler/dates";
import { fromZonedTime, toZonedNaive } from "@/lib/timezone";

const pad = (n: number) => String(n).padStart(2, "0");

/** Date, time and timezone for a scheduled post, with next free slots. */
export function SchedulePicker({
  value,
  timezone,
  excludePostId,
  onChange,
  onTimezoneChange,
}: {
  value: Date | null;
  timezone: string;
  excludePostId?: string;
  onChange: (next: Date | null) => void;
  onTimezoneChange: (timezone: string) => void;
}) {
  const weekStartsOn = useWeekStartsOn();
  const slots = useNextSlots({ timezone, count: 4, excludePostId });

  // Work in wall-clock time of the selected zone.
  const naive = useMemo(
    () => (value ? toZonedNaive(value, timezone) : null),
    [value, timezone],
  );
  const todayNaive = toZonedNaive(new Date(), timezone);
  const startOfToday = new Date(
    todayNaive.getFullYear(),
    todayNaive.getMonth(),
    todayNaive.getDate(),
  );

  const set = (date: Date, hours: number, minutes: number) => {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
    onChange(fromZonedTime(next, timezone));
  };

  const defaultTime = () => {
    // Next round half hour, at least 15 minutes out.
    const soon = new Date(todayNaive.getTime() + 15 * 60_000);
    const minutes = soon.getMinutes() <= 30 ? 30 : 60;
    soon.setMinutes(minutes, 0, 0);
    return { hours: soon.getHours(), minutes: soon.getMinutes() };
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <Calendar
        mode="single"
        weekStartsOn={weekStartsOn}
        selected={naive ?? undefined}
        defaultMonth={naive ?? todayNaive}
        disabled={{ before: startOfToday }}
        onSelect={(day) => {
          if (!day) return;
          const time = naive
            ? { hours: naive.getHours(), minutes: naive.getMinutes() }
            : defaultTime();
          set(day, time.hours, time.minutes);
        }}
        className="p-2"
      />
      <div className="flex w-full flex-col gap-4 sm:w-64">
        <Field>
          <FieldLabel htmlFor="schedule-time">Time</FieldLabel>
          <Input
            id="schedule-time"
            type="time"
            step={300}
            value={naive ? `${pad(naive.getHours())}:${pad(naive.getMinutes())}` : ""}
            onChange={(event) => {
              const [h, m] = event.target.value.split(":").map(Number);
              if (Number.isNaN(h) || Number.isNaN(m)) return;
              set(naive ?? todayNaive, h, m);
            }}
          />
        </Field>
        <Field>
          <FieldLabel>Timezone</FieldLabel>
          <TimezoneCombobox
            value={timezone}
            onChange={(zone) => {
              // Keep the same wall-clock time in the new zone.
              if (naive) onChange(fromZonedTime(naive, zone));
              onTimezoneChange(zone);
            }}
            className="w-full"
          />
        </Field>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Next free slots</p>
          {slots.isLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : slots.data?.slots.length ? (
            <div className="flex flex-col gap-1">
              {slots.data.slots.map((iso) => (
                <Button
                  key={iso}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start font-normal"
                  onClick={() => onChange(new Date(iso))}
                >
                  <Clock className="text-muted-foreground" />
                  {formatDayTime(iso, timezone)}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Set posting times on the Queue page to get suggestions.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
