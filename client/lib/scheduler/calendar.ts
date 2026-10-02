import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fromZonedTime, toZonedNaive } from "@/lib/timezone";

/**
 * Calendar math runs on "naive" dates: plain Date objects whose local fields
 * hold wall-clock time in the scheduler timezone. Convert with toUtc/fromUtc
 * at the edges only.
 */
export type CalendarView = "month" | "week" | "day";

export const toUtc = (naive: Date, timeZone: string) => fromZonedTime(naive, timeZone);
export const fromUtc = (instant: Date | string, timeZone: string) =>
  toZonedNaive(typeof instant === "string" ? new Date(instant) : instant, timeZone);

export function todayIn(timeZone: string) {
  return startOfDay(fromUtc(new Date(), timeZone));
}

export function visibleDays(view: CalendarView, anchor: Date, weekStartsOn: 0 | 1) {
  if (view === "day") return [startOfDay(anchor)];
  if (view === "week") {
    const start = startOfWeek(anchor, { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn });
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn });
  const days: Date[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

/** UTC bounds to fetch for the visible days. */
export function rangeFor(days: Date[], timeZone: string) {
  return {
    from: toUtc(days[0], timeZone).toISOString(),
    to: toUtc(addDays(days[days.length - 1], 1), timeZone).toISOString(),
  };
}

export function shift(view: CalendarView, anchor: Date, direction: 1 | -1) {
  if (view === "month") return addMonths(anchor, direction);
  if (view === "week") return addWeeks(anchor, direction);
  return addDays(anchor, direction);
}

export function rangeLabel(view: CalendarView, days: Date[], anchor: Date) {
  if (view === "month") return format(anchor, "MMMM yyyy");
  if (view === "day") return format(anchor, "EEEE, MMMM d, yyyy");
  const first = days[0];
  const last = days[days.length - 1];
  if (first.getMonth() === last.getMonth()) {
    return `${format(first, "MMM d")} to ${format(last, "d, yyyy")}`;
  }
  if (first.getFullYear() === last.getFullYear()) {
    return `${format(first, "MMM d")} to ${format(last, "MMM d, yyyy")}`;
  }
  return `${format(first, "MMM d, yyyy")} to ${format(last, "MMM d, yyyy")}`;
}

export const dayId = (day: Date) => format(day, "yyyy-MM-dd");

/** Parses "yyyy-MM-dd" into a naive local date. */
export function parseDayId(id: string) {
  const [y, m, d] = id.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const HOUR_HEIGHT = 72;
export const SLOT_MINUTES = 60;
