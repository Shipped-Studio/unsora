import type { Plan, User } from "@prisma/client";
import { CreditSource, SubscriptionKind } from "@prisma/client";
import Stripe from "stripe";
import { clerkClient } from "@clerk/express";
import prisma from "../lib/db";
import { stripe } from "../lib/stripe";
import { logger } from "../lib/logger";
import {
  expireSubscriptionGrants,
  getMonthlyCreditsSummary,
  getSubscriptionCreditsRemaining,
  rolloverSubscriptionCycle,
} from "../lib/credits";
import { getCreditPlanByStripePriceId, getPlanByKey, toPublicPlan } from "../lib/plans";
import { stripeStateOf, syncPlanToStripe } from "../lib/plan-stripe";
import { onPaymentFailed, onSubscriptionStarted } from "../emails";

/**
 * The Monthly credits subscription: a second Stripe subscription a user can
 * hold next to (or instead of) their scheduler plan. The scheduler plan stays
 * on the User row; this one is the user's CREDITS `Subscription` row.
 *
 *   - No free trial. Each paid invoice grants the plan's credits, expiring at
 *     the end of that billing period (MONTHLY_CREDITS grants). Unused ones
 *     don't roll over; top-ups never expire and are spent last
 *     (consumeCredits spends soonest-expiring first).
 *   - A failed renewal grants nothing until it's paid. Credits already
 *     granted keep working until they expire.
 *   - Switching tiers starts a new subscription; on its first invoice the
 *     leftover monthly credits move into the new bucket and the old
 *     subscription is cancelled without a refund (its credits came along).
 *
 * The Stripe webhook classifies every subscription with
 * `classifySubscription` first and hands credit subscriptions to the
 * handlers here, so they never touch the scheduler columns.
 */

/** Stamped on credit subscriptions' metadata at checkout. */
export const CREDIT_SUBSCRIPTION_KIND = "credit_subscription";

/**
 * Subscription states that keep the subscription. past_due is the window
 * where Stripe is still retrying a failed payment.
 */
export const LIVE_SUBSCRIPTION_STATUSES: Stripe.Subscription.Status[] = [
  "active",
  "trialing",
  "past_due",
];

const MONTHLY = CreditSource.MONTHLY_CREDITS;
const CREDITS = SubscriptionKind.CREDITS;

export type SubscriptionRoute = { kind: "scheduler" } | { kind: "credits"; plan: Plan | null };

/**
 * Which subscription this is. A credit subscription is recognised by its
 * price (current or previous price of a CREDIT_SUBSCRIPTION plan), by the
 * metadata checkout stamps on it, or by our own row, so a price archived in
 * Stripe or edited in the portal still routes the right way.
 */
export async function classifySubscription(sub: Stripe.Subscription): Promise<SubscriptionRoute> {
  const priceId = sub.items.data[0]?.price.id;
  const byPrice = priceId ? await getCreditPlanByStripePriceId(priceId) : null;
  if (byPrice) return { kind: "credits", plan: byPrice };

  const row = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
    select: { planKey: true, kind: true },
  });
  if (row?.kind === "CREDITS" || sub.metadata?.kind === CREDIT_SUBSCRIPTION_KIND) {
    const key = row?.planKey ?? sub.metadata?.planKey;
    const plan = key ? await getPlanByKey(key) : null;
    return { kind: "credits", plan: plan?.type === "CREDIT_SUBSCRIPTION" ? plan : null };
  }
  return { kind: "scheduler" };
}

function periodEndOf(sub: Stripe.Subscription): Date | null {
  const unix = sub.items.data[0]?.current_period_end;
  return unix ? new Date(unix * 1000) : null;
}

/**
 * Mirror a credit subscription's Stripe state onto the user's row. While a
 * tier switch is in flight the user has two live credit subscriptions; the
 * newer one wins, so a late event about the old one can't take the row back.
 * Returns false when the event was ignored.
 */
export async function syncCreditSubscription(
  userId: string,
  sub: Stripe.Subscription,
  plan: Plan | null,
): Promise<boolean> {
  const live = LIVE_SUBSCRIPTION_STATUSES.includes(sub.status);
  const existing = await prisma.subscription.findUnique({
    where: { userId_kind: { userId, kind: CREDITS } },
  });

  if (existing && existing.stripeSubscriptionId !== sub.id) {
    // A dead subscription that isn't the current one: teardown noise.
    if (!live) return false;
    if (existing.isActive) {
      const current = await stripe.subscriptions
        .retrieve(existing.stripeSubscriptionId)
        .catch(() => null);
      if (
        current &&
        LIVE_SUBSCRIPTION_STATUSES.includes(current.status) &&
        current.created > sub.created
      ) {
        return false;
      }
    }
  }

  const planKey = plan?.key ?? existing?.planKey ?? sub.metadata?.planKey ?? "unknown";
  const data = {
    stripeSubscriptionId: sub.id,
    stripePriceId: sub.items.data[0]?.price.id ?? null,
    planKey,
    status: sub.status,
    isActive: live,
    isCancelled: sub.status === "canceled" || !!sub.cancel_at_period_end,
    currentPeriodEnd: periodEndOf(sub),
  };
  await prisma.subscription.upsert({
    where: { userId_kind: { userId, kind: CREDITS } },
    create: { userId, kind: CREDITS, ...data },
    update: data,
  });
  return true;
}

/**
 * Mirror the credits plan into Clerk's metadata, next to the scheduler
 * `plan`: the client's onboarding gate reads it to let a credits-only
 * customer into the app. Best effort; the database is the source of truth.
 */
async function syncClerkCreditsPlan(clerkId: string, planKey: string | null) {
  try {
    await clerkClient.users.updateUserMetadata(clerkId, {
      unsafeMetadata: { creditsPlan: planKey },
    });
  } catch (err) {
    logger.warn("Couldn't sync the credits plan to Clerk", { clerkId, err });
  }
}

/** Plan key of the newest live monthly credit bucket, from its grant reason. */
async function currentMonthlyPlanKey(userId: string): Promise<string | null> {
  const grant = await prisma.creditGrant.findFirst({
    where: { userId, source: MONTHLY, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { reason: true },
  });
  const [prefix, key] = grant?.reason?.split(":") ?? [];
  return prefix === "monthly-credits" && key ? key : null;
}

/**
 * A credit subscription invoice was paid: sync the row and grant this
 * period's credits. Keyed on the invoice id, so a webhook retry grants once.
 */
export async function handleCreditInvoicePaid(opts: {
  user: User;
  invoice: Stripe.Invoice;
  sub: Stripe.Subscription;
  plan: Plan | null;
}): Promise<void> {
  const { user, invoice, sub, plan } = opts;
  const synced = await syncCreditSubscription(user.id, sub, plan);

  const billingReason = invoice.billing_reason;
  const isCreate = billingReason === "subscription_create";
  const isCycle = billingReason === "subscription_cycle";
  const isUpdate = billingReason === "subscription_update";
  if (!isCreate && !isCycle && !isUpdate) return;

  if (!plan) {
    logger.error("Paid credit subscription invoice with no matching plan; no credits granted", {
      userId: user.id,
      subscriptionId: sub.id,
      invoiceId: invoice.id,
    });
    return;
  }
  // A paid invoice for a superseded subscription (its last cycle raced the
  // switch) must not reset the new tier's bucket.
  if (!synced) {
    logger.warn("Paid invoice for a superseded credit subscription; no credits granted", {
      userId: user.id,
      subscriptionId: sub.id,
      invoiceId: invoice.id,
    });
    return;
  }

  // A tier switch from the app: a new subscription that names the old one.
  const switchedFrom = sub.metadata?.upgradeFromSubscriptionId;
  const isSwitch = isCreate && !!switchedFrom && switchedFrom !== sub.id;
  // A tier switched in place (Stripe portal) bills as subscription_update.
  // Any other update invoice (proration for nothing that adds credits)
  // grants nothing: the period's credits were already granted.
  const previousKey = isUpdate ? await currentMonthlyPlanKey(user.id) : null;
  const isInPlaceSwitch = isUpdate && previousKey !== null && previousKey !== plan.key;
  if (isUpdate && !isInPlaceSwitch) return;

  const reason = `monthly-credits:${plan.key}:${billingReason}:${invoice.id}`;
  const already = await prisma.creditGrant.findFirst({
    where: { userId: user.id, reason },
    select: { id: true },
  });

  if (!already) {
    const periodEnd = periodEndOf(sub) ?? new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    // What's left of the old tier this period moves along on a switch; a
    // renewal starts from zero (monthly credits don't roll over).
    const carryover =
      isSwitch || isInPlaceSwitch ? await getSubscriptionCreditsRemaining(user.id, MONTHLY) : 0;

    await rolloverSubscriptionCycle({
      userId: user.id,
      amount: plan.credits + carryover,
      expiresAt: periodEnd,
      reason,
      source: MONTHLY,
      metadata: {
        stripeSubscriptionId: sub.id,
        stripeInvoiceId: invoice.id ?? null,
        billingReason,
        planCredits: plan.credits,
        ...(carryover > 0 ? { carryoverCredits: carryover } : {}),
        ...(isSwitch ? { switchedFromSubscriptionId: switchedFrom } : {}),
      },
    });

    if (isCreate) {
      void onSubscriptionStarted({
        userId: user.id,
        email: user.email,
        invoiceId: invoice.id ?? sub.id,
        planName: plan.name,
        credits: plan.credits + carryover,
        planCredits: plan.credits,
        kind: isSwitch ? "upgraded" : "paid",
        product: "credits",
        periodEnd,
        amountPaidCents: invoice.amount_paid,
        currency: invoice.currency,
        interval: sub.items.data[0]?.price.recurring?.interval ?? null,
        signupAt: user.createdAt,
      });
    }
  }

  await syncClerkCreditsPlan(user.clerkId, plan.key);

  // Cancel the tier the user switched away from. Outside the grant guard so
  // a failed cancel is retried with the webhook; after the row was repointed
  // above, so the old subscription's `deleted` event finds no row and leaves
  // the new bucket alone. No proration: the old tier's credits came along.
  if (isSwitch && switchedFrom) {
    try {
      const old = await stripe.subscriptions.retrieve(switchedFrom);
      if (old.status !== "canceled") {
        await stripe.subscriptions.cancel(switchedFrom, { prorate: false });
      }
    } catch (err) {
      logger.error(`Failed to cancel superseded credit subscription ${switchedFrom}:`, err);
    }
  }
}

/** A credit subscription charge failed: record past_due, email once. */
export async function handleCreditInvoiceFailed(opts: {
  user: User;
  invoice: Stripe.Invoice;
  sub: Stripe.Subscription;
  plan: Plan | null;
}): Promise<void> {
  const { user, invoice, sub, plan } = opts;
  const synced = await syncCreditSubscription(user.id, sub, plan);
  if (!synced) return;

  // Stripe sends this on every retry of the charge; email once.
  if ((invoice.attempt_count ?? 1) <= 1) {
    void onPaymentFailed({
      email: user.email,
      invoiceId: invoice.id ?? sub.id,
      planName: plan?.name ?? "Monthly credits",
      amountCents: invoice.amount_due,
      currency: invoice.currency,
      product: "credits",
    });
  }
}

/**
 * A credit subscription ended (cancelled at period end, retries ran out, or
 * cancelled in Stripe). Its monthly credits end with it; top-ups stay. A
 * subscription the user already switched away from has no row and is
 * ignored, so the new tier's credits are safe.
 */
export async function handleCreditSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const row = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
  });
  if (!row || row.kind !== CREDITS) {
    logger.warn(`credit subscription ${sub.id} deleted with no row (superseded); ignoring`);
    return;
  }
  await expireSubscriptionGrants(row.userId, `monthly-credits:${row.planKey}:deleted:${sub.id}`, MONTHLY);
  await prisma.subscription.update({
    where: { id: row.id },
    data: { status: sub.status, isActive: false, isCancelled: true },
  });
  const owner = await prisma.user.findUnique({
    where: { id: row.userId },
    select: { clerkId: true },
  });
  if (owner) await syncClerkCreditsPlan(owner.clerkId, null);
}

/**
 * The Stripe price to sell `plan` at. Tiers seeded by migration or saved
 * without Stripe have none yet, so it's created on first checkout. Two
 * first checkouts at once can each create one; the first saved is used.
 */
export async function ensureStripePrice(plan: Plan): Promise<string> {
  if (plan.stripePriceId) return plan.stripePriceId;
  const synced = await syncPlanToStripe(plan, stripeStateOf(plan), false);
  if (!synced.stripePriceId) throw new Error(`Plan ${plan.key} can't be sold: no price`);
  await prisma.plan.updateMany({
    where: { id: plan.id, stripePriceId: null },
    data: { stripePriceId: synced.stripePriceId, stripeProductId: synced.stripeProductId },
  });
  const saved = await prisma.plan.findUnique({ where: { id: plan.id } });
  return saved?.stripePriceId ?? synced.stripePriceId;
}

/** The user's credit subscription as the billing UI shows it, or null. */
export async function creditSubscriptionSummary(userId: string) {
  const row = await prisma.subscription.findUnique({
    where: { userId_kind: { userId, kind: CREDITS } },
  });
  const monthly = await getMonthlyCreditsSummary(userId);
  if (!row) return { subscription: null, monthly };

  const plan = await getPlanByKey(row.planKey);
  const pub = plan ? toPublicPlan(plan) : null;
  return {
    subscription: {
      planKey: row.planKey,
      planName: pub?.name ?? row.planKey,
      credits: pub?.credits ?? 0,
      priceUsd: pub?.priceUsd ?? null,
      interval: pub?.interval ?? "MONTH",
      status: row.status,
      isActive: row.isActive,
      isCancelled: row.isCancelled,
      currentPeriodEnd: row.currentPeriodEnd,
    },
    monthly,
  };
}
