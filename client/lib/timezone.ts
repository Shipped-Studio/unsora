/**
 * Timezone utilities for converting between "naive" wall-clock dates and
 * absolute UTC instants. Implemented with `Intl.DateTimeFormat` so we don't
 * need an extra dependency. DST transitions are handled by the two-pass
 * refinement in `fromZonedTime`.
 */

export const FALLBACK_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

let cachedTimezones: string[] | null = null;

export function getAllTimezones(): string[] {
  if (cachedTimezones) return cachedTimezones;
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf;
    if (typeof fn === "function") {
      cachedTimezones = fn("timeZone");
      return cachedTimezones!;
    }
  } catch {
    // Fall through to fallback list.
  }
  cachedTimezones = [...FALLBACK_TIMEZONES];
  return cachedTimezones;
}

/**
 * Returns the offset (in milliseconds) of `timeZone` at the given UTC instant.
 * A positive value means the zone is ahead of UTC.
 */
function getTimezoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUTC - date.getTime();
}

/**
 * Treat the local-time components of `naiveDate` (its `getFullYear`,
 * `getHours`, etc.) as wall-clock time in `timeZone` and return the
 * corresponding absolute UTC `Date`.
 */
export function fromZonedTime(naiveDate: Date, timeZone: string): Date {
  const naiveAsUTC = Date.UTC(
    naiveDate.getFullYear(),
    naiveDate.getMonth(),
    naiveDate.getDate(),
    naiveDate.getHours(),
    naiveDate.getMinutes(),
    naiveDate.getSeconds(),
    naiveDate.getMilliseconds(),
  );
  // Two-pass refinement so the DST transition hour resolves cleanly.
  const firstGuess = naiveAsUTC - getTimezoneOffsetMs(new Date(naiveAsUTC), timeZone);
  const refined = naiveAsUTC - getTimezoneOffsetMs(new Date(firstGuess), timeZone);
  return new Date(refined);
}

/**
 * Convert an absolute UTC instant into a "naive" local-time `Date` whose
 * `getHours`/`getMinutes`/etc. report the wall-clock time in `timeZone`.
 * The returned Date's actual UTC value should not be relied on; only its
 * local-component getters are meaningful.
 */
export function toZonedNaive(utcDate: Date, timeZone: string): Date {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(utcDate);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return new Date(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
    0,
  );
}

/**
 * Return a label like "GMT+6" or "GMT-05:30" for the given timezone at
 * (optionally) the given instant.
 */
export function getTimezoneOffsetLabel(timeZone: string, at: Date = new Date()): string {
  const offsetMinutes = getTimezoneOffsetMs(at, timeZone) / 60000;
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const mins = Math.round(abs % 60);
  const minPart = mins === 0 ? "" : `:${String(mins).padStart(2, "0")}`;
  return `GMT${sign}${hours}${minPart}`;
}

/** Pretty timezone name: "Asia/Dhaka" → "Asia / Dhaka". */
export function formatTimezoneName(timeZone: string): string {
  return timeZone.replace(/_/g, " ").replace(/\//g, " / ");
}

/** Compose a label like "Asia / Dhaka (GMT+6)". */
export function formatTimezoneLabel(timeZone: string, at?: Date): string {
  return `${formatTimezoneName(timeZone)} (${getTimezoneOffsetLabel(timeZone, at)})`;
}
