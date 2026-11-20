"use client";

import { useQuery } from "@tanstack/react-query";

/** The featured promotion, as the server describes it (GET /api/stripe/promotion). */
export interface Promotion {
  code: string;
  percentOff: number | null;
  amountOffCents: number | null;
  currency: string | null;
  duration: "once" | "repeating" | "forever";
  durationInMonths: number | null;
  /** Plan keys the discount applies to. */
  planKeys: string[];
  covers: { scheduler: boolean; aiStudio: boolean; packs: boolean };
  expiresAt: string | null;
  remaining: number | null;
  bannerText: string | null;
}

export const promotionQueryKey = ["promotion"] as const;

/**
 * The promotion running right now, or null. Public (no sign-in), so the
 * same data drives the app's banner and prices and the landing page's.
 */
export function usePromotion(): Promotion | null {
  const { data } = useQuery({
    queryKey: promotionQueryKey,
    queryFn: async (): Promise<Promotion | null> => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stripe/promotion`);
      const json = await res.json().catch(() => null);
      return res.ok && json?.success ? (json.data as Promotion | null) : null;
    },
    // An expired code stops showing straight away, even before the next fetch.
    select: (promo) => (promo?.expiresAt && Date.parse(promo.expiresAt) <= Date.now() ? null : promo),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
  return data ?? null;
}

/** The discounted price of `priceUsd`, or null when the promotion doesn't cover `planKey`. */
export function discountedPrice(promo: Promotion | null, planKey: string, priceUsd: number): number | null {
  if (!promo || !promo.planKeys.includes(planKey)) return null;
  if (promo.percentOff) return Math.max(0, Math.round(priceUsd * (100 - promo.percentOff)) / 100);
  if (promo.amountOffCents) return Math.max(0, priceUsd - promo.amountOffCents / 100);
  return null;
}

/** "50% off", "$10 off". */
export function discountLabel(promo: Promotion): string {
  if (promo.percentOff) return `${Number(promo.percentOff.toFixed(2))}% off`;
  const amount = (promo.amountOffCents ?? 0) / 100;
  return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)} off`;
}

/** How long it lasts: "for 6 months", "for your first month", "on your first payment". */
export function durationLabel(promo: Promotion): string {
  if (promo.duration === "forever") return "for as long as you stay subscribed";
  if (promo.duration === "once") return "on your first payment";
  const months = promo.durationInMonths ?? 1;
  return months === 1 ? "for your first month" : `for ${months} months`;
}

/** What it's for: "the scheduler", "AI Studio", "credit packs", or several. */
export function coversLabel(promo: Promotion): string {
  const parts = [
    promo.covers.scheduler ? "the scheduler" : null,
    promo.covers.aiStudio ? "AI Studio" : null,
    promo.covers.packs ? "credit packs" : null,
  ].filter((p): p is string => !!p);
  if (parts.length === 3) return "every plan";
  return parts.join(" and ");
}
