import type { Plan, PlanType } from "@prisma/client";
import prisma from "./db";

/**
 * Plan service — thin wrapper around the `Plan` table.
 *
 * Every credit-bearing offering lives here:
 *   - SUBSCRIPTION : recurring tiers (basic / pro / power). Mapped to a
 *     Stripe Price via `stripePriceId`. Webhooks look this up to know how
 *     many credits to mint per cycle.
 *   - TOPUP        : one-time credit packs shown in the billing UI.
 *   - PROMO        : reserved for one-off grants (welcome bonus etc.).
 *
 * Anything that previously hardcoded credits/prices should now go through
 * one of these helpers.
 */

export type PlanRecord = Plan;

/**
 * Public-facing shape used by the client + checkout flows. Cents are
 * converted to dollars only at the boundary so internal math stays integer.
 */
export interface PublicPlan {
  key: string;
  name: string;
  description: string | null;
  type: PlanType;
  credits: number;
  priceCents: number;
  priceUsd: number;
  currency: string;
  interval: "MONTH" | "YEAR" | null;
  trialDays: number | null;
  stripePriceId: string | null;
  stripeProductId: string | null;
  sortOrder: number;
  isActive: boolean;
  isPopular: boolean;
}

export function toPublicPlan(plan: Plan): PublicPlan {
  return {
    key: plan.key,
    name: plan.name,
    description: plan.description,
    type: plan.type,
    credits: plan.credits,
    priceCents: plan.priceCents,
    priceUsd: plan.priceCents / 100,
    currency: plan.currency,
    interval: plan.interval,
    trialDays: plan.trialDays,
    stripePriceId: plan.stripePriceId,
    stripeProductId: plan.stripeProductId,
    sortOrder: plan.sortOrder,
    isActive: plan.isActive,
    isPopular: plan.isPopular,
  };
}

/**
 * Fetch all currently-active plans of a given type, ordered for display.
 */
export async function listActivePlans(type: PlanType): Promise<Plan[]> {
  return prisma.plan.findMany({
    where: { type, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }],
  });
}

/** All TOPUP plans the billing UI can sell. */
export async function listTopupPlans(): Promise<Plan[]> {
  return listActivePlans("TOPUP");
}

/** All SUBSCRIPTION plans (basic / pro / power / etc.). */
export async function listSubscriptionPlans(): Promise<Plan[]> {
  return listActivePlans("SUBSCRIPTION");
}

/** Lookup by stable key. Returns null if no row matches. */
export async function getPlanByKey(key: string): Promise<Plan | null> {
  return prisma.plan.findUnique({ where: { key } });
}

/** Lookup a TOPUP pack by key, ignoring inactive rows. */
export async function getTopupPlan(key: string): Promise<Plan | null> {
  const plan = await getPlanByKey(key);
  if (!plan) return null;
  if (plan.type !== "TOPUP") return null;
  if (!plan.isActive) return null;
  return plan;
}

/**
 * Look up a SUBSCRIPTION plan by Stripe Price ID. Used by the Stripe webhook
 * to translate `customer.subscription.updated` / `invoice.payment_succeeded`
 * into a credit grant.
 */
export async function getSubscriptionPlanByStripePriceId(
  stripePriceId: string,
): Promise<Plan | null> {
  return prisma.plan.findFirst({
    where: { stripePriceId, type: "SUBSCRIPTION" },
  });
}

/**
 * Resolve how many credits a subscription should grant in a given cycle.
 *
 * Trials get a SMALL "trial allotment" — NOT the chosen tier's full bucket.
 * The trial allotment lives on a Plan row with `key = "trial"`. When a user
 * converts from trial to paid, the next `invoice.payment_succeeded` webhook
 * fires with `isTrial = false` and resolves to the real tier's credits.
 *
 * Resolution order:
 *   - If `isTrial` is true:
 *       1. The `trial` Plan row (whatever credits you've configured there).
 *       2. Fallback: 0 — better to grant nothing than to silently mint a
 *          full bucket you didn't intend.
 *   - Otherwise (paid cycle):
 *       1. Stripe Price ID match in the Plan table.
 *       2. Plan name match (case-insensitive) — handy when the Stripe
 *          product name lines up with a Plan.key (e.g. "Pro" -> "pro").
 *       3. Returns 0 (caller decides whether to refuse the grant or fail
 *          open).
 *
 * IMPORTANT: a `Plan` row with `key = "trial"` MUST exist (any `type`,
 * `isActive = true`, `credits` set to the trial allotment) or trial users
 * will get zero credits.
 */
export async function resolveSubscriptionCredits(opts: {
  stripePriceId?: string | null;
  planName?: string | null;
  isTrial?: boolean;
}): Promise<{ credits: number; plan: Plan | null }> {
  if (opts.isTrial) {
    const trial = await getPlanByKey("trial");
    if (trial && trial.isActive) {
      return { credits: trial.credits, plan: trial };
    }
    // No `trial` plan configured — refuse to mint full-tier credits.
    return { credits: 0, plan: null };
  }

  if (opts.stripePriceId) {
    const byPrice = await getSubscriptionPlanByStripePriceId(
      opts.stripePriceId,
    );
    if (byPrice && byPrice.isActive) {
      return { credits: byPrice.credits, plan: byPrice };
    }
  }

  if (opts.planName) {
    const byName = await prisma.plan.findFirst({
      where: {
        type: "SUBSCRIPTION",
        isActive: true,
        key: opts.planName.toLowerCase(),
      },
    });
    if (byName) {
      return { credits: byName.credits, plan: byName };
    }
  }

  return { credits: 0, plan: null };
}
