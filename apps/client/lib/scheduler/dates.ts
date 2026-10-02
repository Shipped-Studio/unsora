import { differenceInCalendarDays, formatDistanceToNowStrict } from "date-fns";
import {
  formatTimezoneName,
  getBrowserTimezone,
  getTimezoneOffsetLabel,
  toZonedNaive,
} from "@/lib/timezone";

export { getBrowserTimezone };

/** Wall-clock parts of an instant in a zone, as a naive local Date. */
export function inZone(date: Date | string, timeZone: string) {
  return toZonedNaive(typeof date === "string" ? new Date(date) : date, timeZone);
}

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const longDayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

/** "9:30 AM" in the zone. */
export function formatTime(date: Date | string, timeZone: string) {
  return timeFormat.format(inZone(date, timeZone));
}

/** "Today", "Tomorrow", "Yesterday" or "Mon, Mar 3", relative to the zone. */
export function formatDay(date: Date | string, timeZone: string, long = false) {
  const local = inZone(date, timeZone);
  const diff = differenceInCalendarDays(local, inZone(new Date(), timeZone));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return (long ? longDayFormat : dayFormat).format(local);
}

/** "Today, 9:30 AM". */
export function formatDayTime(date: Date | string, timeZone: string) {
  return `${formatDay(date, timeZone)}, ${formatTime(date, timeZone)}`;
}

/** "in 3 hours" / "2 days ago". */
export function formatRelative(date: Date | string) {
  return formatDistanceToNowStrict(new Date(date), { addSuffix: true });
}

/** Short zone label like "GMT+6". */
export function zoneLabel(timeZone: string, at?: Date) {
  return getTimezoneOffsetLabel(timeZone, at);
}

export function zoneName(timeZone: string) {
  return formatTimezoneName(timeZone);
}

/** yyyy-MM-dd of an instant in a zone, for grouping by day. */
export function dayKey(date: Date | string, timeZone: string) {
  const local = inZone(date, timeZone);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The date a post belongs on in calendars and lists. */
export function postDate(post: {
  scheduledFor: string | null;
  publishedAt: string | null;
  createdAt: string;
}) {
  return post.scheduledFor ?? post.publishedAt ?? post.createdAt;
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) return "";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}
