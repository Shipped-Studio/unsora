import type { PlanInterval } from "@/hooks/use-subscription-plans";

/** "$19", "$4.99". Whole-dollar prices drop the cents. */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** "October 12, 2026", or null for a missing/invalid date. */
export function formatLongDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** "month" / "year", only when the plan data says so. */
export function intervalLabel(interval: PlanInterval | null | undefined) {
  if (interval === "MONTH") return "month";
  if (interval === "YEAR") return "year";
  return null;
}

/** "1,100 credits per month", or "per billing period" when the interval is unknown. */
export function planCreditsLabel(
  credits: number,
  interval: PlanInterval | null | undefined,
): string {
  const per = intervalLabel(interval);
  return `${credits.toLocaleString()} credits per ${per ?? "billing period"}`;
}

/** Plan keys come back lowercase ("pro"); fall back to a readable name. */
export function planDisplayName(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}
