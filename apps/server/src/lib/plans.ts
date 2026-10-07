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
 * Extra plan settings kept in `Plan.metadata` (edited at /admin/pricing), so
 * new limits don't need a migration:
 *   features              bullet points on the pricing cards
 *   socialAccounts        how many social accounts a subscriber can connect
 *   previousStripePriceIds prices this plan was sold at before a price change;
 *                          existing subscribers stay on them, so the webhook
 *                          still has to map them back to this plan
 */
export interface PlanMeta {
  features?: string[];
  socialAccounts?: number;
  previousStripePriceIds?: string[];
}

// What the original tiers advertised and allowed before these settings lived
// on the plan row. Used until an admin saves the plan with its own values.
const DEFAULT_META: Record<string, { features: string[]; socialAccounts: number }> = {
  basic: {
    socialAccounts: 5,
    features: [
      "5 social accounts",
      "Scheduling, calendar and analytics",
      "REST API and MCP server",
      "All create tools",
    ],
  },
  pro: {
    socialAccounts: 10,
    features: [
      "10 social accounts",
      "Scheduling, calendar and analytics",
      "REST API and MCP server",
      "All create tools",
      "Priority support",
    ],
  },
  power: {
    socialAccounts: 50,
    features: [
      "50 social accounts",
      "Scheduling, calendar and analytics",
      "REST API and MCP server",
      "All create tools",
      "Priority support",
    ],
  },
  // Hand-assigned enterprise accounts (no Plan row).
  custom: { socialAccounts: 50, features: [] },
};

export function planMeta(plan: Pick<Plan, "metadata">): PlanMeta {
  const m = plan.metadata;
  return m && typeof m === "object" && !Array.isArray(m) ? (m as PlanMeta) : {};
}

export function planFeatures(plan: Pick<Plan, "key" | "metadata">): string[] {
  const features = planMeta(plan).features;
  return Array.isArray(features) ? features : (DEFAULT_META[plan.key]?.features ?? []);
}

export function planSocialAccounts(plan: Pick<Plan, "key" | "metadata">): number | null {
  const n = planMeta(plan).socialAccounts;
  return typeof n === "number" && n >= 0 ? n : (DEFAULT_META[plan.key]?.socialAccounts ?? null);
}

/**
 * The SUBSCRIPTION plan behind `User.plan`. That column holds the Stripe
 * product name ("Pro") or, when an admin set it, the plan key ("pro"), so
 * both are matched case-insensitively.
 */
export async function findSubscriptionPlan(value: string | null | undefined): Promise<Plan | null> {
  const v = value?.trim();
  if (!v || v.toLowerCase() === "free") return null;
  return prisma.plan.findFirst({
    where: {
      type: "SUBSCRIPTION",
      OR: [
        { key: { equals: v, mode: "insensitive" } },
        { name: { equals: v, mode: "insensitive" } },
      ],
    },
    orderBy: { isActive: "desc" },
  });
}

/**
 * Social accounts a user on `planValue` may connect, or null when the plan
 * doesn't allow connecting (free, unknown).
 */
export async function socialAccountLimitFor(planValue: string | null | undefined): Promise<number | null> {
  const plan = await findSubscriptionPlan(planValue);
  if (plan) return planSocialAccounts(plan);
  const key = planValue?.trim().toLowerCase();
  return key ? (DEFAULT_META[key]?.socialAccounts ?? null) : null;
}

const DEFAULT_TRIAL_DAYS = 3;

/**
 * Length of the first-subscription free trial. It lives on the `trial` row
 * (next to the trial's credit allotment) so one setting covers every plan;
 * 0 turns trials off.
 */
export async function trialDays(): Promise<number> {
  const trial = await getPlanByKey("trial");
  if (!trial || !trial.isActive) return 0;
  return trial.trialDays ?? DEFAULT_TRIAL_DAYS;
}

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
  const current = await prisma.plan.findFirst({
    where: { stripePriceId, type: "SUBSCRIPTION" },
  });
  if (current) return current;
  // Subscribers who signed up before a price change stay on the old price.
  return prisma.plan.findFirst({
    where: {
      type: "SUBSCRIPTION",
      metadata: { path: ["previousStripePriceIds"], array_contains: [stripePriceId] },
    },
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
 *       2. Plan key or name match (case-insensitive) — the Stripe product
 *          name is the plan name ("Pro" -> "pro").
 *       3. Returns 0 (caller decides whether to refuse the grant or fail
 *          open).
 *
 * IMPORTANT: a `Plan` row with `key = "trial"` MUST exist (any `type`,
 * `credits` set to the trial allotment) or trial users will get zero
 * credits. Its `isActive` decides whether new subscriptions get a trial.
 */
export async function resolveSubscriptionCredits(opts: {
  stripePriceId?: string | null;
  planName?: string | null;
  isTrial?: boolean;
}): Promise<{ credits: number; plan: Plan | null }> {
  if (opts.isTrial) {
    // Switching the trial off only stops new trials (see trialDays), so
    // trials already running still get their allotment.
    const trial = await getPlanByKey("trial");
    if (trial) {
      return { credits: trial.credits, plan: trial };
    }
    // No `trial` plan configured — refuse to mint full-tier credits.
    return { credits: 0, plan: null };
  }

  // `isActive` only controls whether a plan can be bought; people already
  // subscribed keep getting its credits after it's switched off.
  if (opts.stripePriceId) {
    const byPrice = await getSubscriptionPlanByStripePriceId(
      opts.stripePriceId,
    );
    if (byPrice) {
      return { credits: byPrice.credits, plan: byPrice };
    }
  }

  if (opts.planName) {
    const byName = await findSubscriptionPlan(opts.planName);
    if (byName) {
      return { credits: byName.credits, plan: byName };
    }
  }

  return { credits: 0, plan: null };
}
