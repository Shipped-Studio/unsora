import type { Plan, PlanInterval, PlanType } from "@prisma/client";
import { stripe } from "./stripe";
import { planMeta, type PlanMeta } from "./plans";

/**
 * Keeps sellable plans (SUBSCRIPTION, TOPUP) backed by a Stripe product and
 * price, so an admin can create or reprice a plan without opening Stripe.
 *
 * Stripe prices can't change amount, so a new amount (or currency, or
 * interval) means a new price on the same product. The old price is archived
 * — new checkouts can't use it — but existing subscriptions keep billing on
 * it, so its id goes into `previousStripePriceIds` for the webhook to map
 * renewals back to this plan.
 */

export interface PlanStripeState {
  key: string;
  name: string;
  description: string | null;
  type: PlanType;
  priceCents: number;
  currency: string;
  interval: PlanInterval | null;
  stripePriceId: string | null;
  stripeProductId: string | null;
  metadata: PlanMeta;
}

export function stripeMode(): "live" | "test" {
  return process.env.STRIPE_SECRET_KEY?.startsWith("sk_live") ? "live" : "test";
}

function sellable(plan: PlanStripeState) {
  return (plan.type === "SUBSCRIPTION" || plan.type === "TOPUP") && plan.priceCents > 0;
}

function productName(plan: PlanStripeState) {
  // Subscription product names land in User.plan via the webhook, so they
  // must stay the plain plan name. Packs get a clearer checkout label.
  return plan.type === "TOPUP" ? `${plan.name} credit pack` : plan.name;
}

/**
 * Bring Stripe in line with `next` (the plan as it's about to be saved) and
 * return the Stripe fields to save with it. `before` is the stored row, or
 * null for a new plan. `priceIdSetByAdmin` skips price creation when the
 * admin pasted a price id themselves.
 */
export async function syncPlanToStripe(
  before: Plan | null,
  next: PlanStripeState,
  priceIdSetByAdmin: boolean,
): Promise<Pick<PlanStripeState, "stripePriceId" | "stripeProductId" | "metadata">> {
  let { stripePriceId, stripeProductId } = next;
  const metadata: PlanMeta = { ...next.metadata };

  if (!sellable(next)) return { stripePriceId, stripeProductId, metadata };

  if (priceIdSetByAdmin && stripePriceId) {
    const price = await stripe.prices.retrieve(stripePriceId);
    const product = typeof price.product === "string" ? price.product : price.product.id;
    if (before?.stripePriceId && before.stripePriceId !== stripePriceId) {
      remember(metadata, before.stripePriceId, stripePriceId);
    }
    return { stripePriceId, stripeProductId: product, metadata };
  }

  if (!stripeProductId && stripePriceId) {
    const price = await stripe.prices.retrieve(stripePriceId);
    stripeProductId = typeof price.product === "string" ? price.product : price.product.id;
  }

  if (!stripeProductId) {
    const product = await stripe.products.create({
      name: productName(next),
      ...(next.description ? { description: next.description } : {}),
      metadata: { planKey: next.key, planType: next.type },
    });
    stripeProductId = product.id;
  } else if (
    before &&
    (before.name !== next.name || (before.description ?? null) !== next.description)
  ) {
    await stripe.products.update(stripeProductId, {
      name: productName(next),
      // An empty string clears the description in Stripe.
      description: next.description ?? "",
    });
  }

  const priceChanged =
    !stripePriceId ||
    !before ||
    before.priceCents !== next.priceCents ||
    before.currency !== next.currency ||
    before.interval !== next.interval;

  if (priceChanged) {
    const price = await stripe.prices.create({
      product: stripeProductId,
      unit_amount: next.priceCents,
      currency: next.currency,
      ...(next.type === "SUBSCRIPTION" && next.interval
        ? { recurring: { interval: next.interval === "YEAR" ? "year" : "month" } }
        : {}),
      metadata: { planKey: next.key },
    });

    const old = stripePriceId;
    stripePriceId = price.id;
    if (old) {
      await stripe.prices.update(old, { active: false }).catch((err) => {
        console.warn(`[plans] couldn't archive old Stripe price ${old}:`, err);
      });
      remember(metadata, old, price.id);
    }
  }

  return { stripePriceId, stripeProductId, metadata };
}

/** Record `old` as a price existing subscribers may still be billed on. */
function remember(metadata: PlanMeta, old: string, current: string) {
  const previous = new Set(metadata.previousStripePriceIds ?? []);
  previous.add(old);
  previous.delete(current);
  metadata.previousStripePriceIds = [...previous];
}

export function stripeStateOf(plan: Plan): PlanStripeState {
  return {
    key: plan.key,
    name: plan.name,
    description: plan.description,
    type: plan.type,
    priceCents: plan.priceCents,
    currency: plan.currency,
    interval: plan.interval,
    stripePriceId: plan.stripePriceId,
    stripeProductId: plan.stripeProductId,
    metadata: planMeta(plan),
  };
}
