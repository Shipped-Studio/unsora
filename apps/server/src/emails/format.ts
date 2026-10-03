/** Formatting helpers shared by email templates. */

/** "Oct 4, 2026, 2:41 PM UTC" */
export function fmtDateTime(date: Date, timeZone = "UTC"): string {
  try {
    const local = date.toLocaleString("en-US", { timeZone, dateStyle: "medium", timeStyle: "short" });
    return `${local} ${timeZone === "UTC" ? "UTC" : `(${timeZone})`}`;
  } catch {
    // Unknown timezone string: fall back to UTC.
    return fmtDateTime(date, "UTC");
  }
}

/** "October 4, 2026" */
export function fmtDate(date: Date): string {
  return date.toLocaleDateString("en-US", { timeZone: "UTC", dateStyle: "long" });
}

/** Cents + ISO currency → "$29.00". Pass withCode for "$29.00 USD". */
export function fmtAmount(cents: number, currency: string, withCode = false): string {
  const upper = currency.toUpperCase();
  let formatted: string;
  try {
    formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: upper }).format(cents / 100);
  } catch {
    formatted = (cents / 100).toFixed(2);
  }
  return withCode ? `${formatted} ${upper}` : formatted;
}

/** 15000 → "15,000" */
export function fmtNumber(value: number): string {
  return value.toLocaleString("en-US");
}

/** Provider id from the database → the platform's name. */
export function platformName(provider: string): string {
  const names: Record<string, string> = {
    google: "YouTube",
    youtube: "YouTube",
    tiktok: "TikTok",
    instagram: "Instagram",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    pinterest: "Pinterest",
    threads: "Threads",
    bluesky: "Bluesky",
    x: "X",
    google_business: "Google Business Profile",
  };
  return names[provider.toLowerCase()] ?? provider;
}
