import { Request, Response } from "express";
import prisma from "../lib/db";
import { stripe } from "../lib/stripe";
import { clerkClient } from "@clerk/express";
import Stripe from "stripe";
import {
  expireSubscriptionGrants,
  getSubscriptionCreditsRemaining,
  grantCredits,
  rolloverSubscriptionCycle,
} from "../lib/credits";
import {
  getPlanByKey,
  getTopupPlan,
  listSubscriptionPlans,
  listTopupPlans,
  resolveSubscriptionCredits,
  toPublicPlan,
} from "../lib/plans";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const SUCCESS_URL = process.env.STRIPE_SUCCESS_URL;
const CANCEL_URL = process.env.STRIPE_CANCEL_URL;
/** Public origin of the web app — used to build top-up return URLs. */
const CLIENT_URL = process.env.CLIENT_URL;

/**
 * Resolve how many credits a subscription cycle should grant.
 *
 * Reads from the `plans` table (source of truth). Behaviour:
 *   - When `isTrial` is true → returns the credits on the `trial` Plan row
 *     (a small "try before you buy" allotment). Returns 0 if the row is
 *     missing — we will NOT silently mint a full tier bucket.
 *   - When `isTrial` is false → looks up the real tier by `stripePriceId`
 *     first, then by plan name. Returns 0 if nothing matches.
 *
 * Callers expire any leftover grants and skip the rollover when 0 is
 * returned.
 */
async function planCreditsFor(opts: {
  stripePriceId?: string | null;
  planName: string;
  isTrial: boolean;
}): Promise<number> {
  const { credits } = await resolveSubscriptionCredits(opts);
  return credits;
}

export class StripeController {
  async handleWebhook(req: Request, res: Response) {
    const sig = req.headers["stripe-signature"];

    if (!sig || !webhookSecret) {
      return res
        .status(400)
        .json({ success: false, error: "Missing signature or webhook secret" });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        (req as any).rawBody,
        sig,
        webhookSecret,
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return res.status(400).json({ success: false, error: "Invalid signature" });
    }

    try {
      switch (event.type) {
        case "customer.created": {
          const customer = event.data.object as Stripe.Customer;

          const user = await prisma.user.findUnique({
            where: {
              email: customer.email as string,
            },
          });

          if (!user) {
            throw new Error("User not found");
          }

          // Update user with Stripe customer ID
          await prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              stripeCustomerId: customer.id,
            },
          });

          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;

          // Get full subscription (plan name)
          const fullSub = await stripe.subscriptions.retrieve(subscription.id, {
            expand: ["items.data.price.product"],
          });

          const planName = (
            fullSub.items.data[0].price.product as Stripe.Product
          ).name;

          // Find user by Stripe customer id
          const user = await prisma.user.findFirst({
            where: { stripeCustomerId: subscription.customer as string },
          });

          if (!user) {
            throw new Error("User not found");
          }

          // Guard against stale events for a subscription the user has
          // upgraded away from: this handler looks the user up by CUSTOMER,
          // so a late `updated` event for the old (now non-active) sub would
          // otherwise overwrite the row with dead-subscription state. Only
          // sync when the event is about the user's current subscription, or
          // when it's a live sub (the initial events for a brand-new
          // subscription arrive before our DB knows its id).
          if (
            user.stripeSubscriptionId &&
            user.stripeSubscriptionId !== subscription.id &&
            !["active", "trialing"].includes(subscription.status)
          ) {
            break;
          }

          // NOTE: We intentionally do NOT auto-cancel a trialing subscription
          // here just because `cancel_at_period_end = true` was toggled.
          // - Letting the trial run to completion is what users expect.
          // - Calling `stripe.subscriptions.cancel` from inside a webhook
          //   re-fires `customer.subscription.deleted`, doubling the work.
          // - "Cancel my trial NOW" is an explicit product action and is
          //   handled by the `cancelTrial` controller endpoint.
          //
          // Normal updates (portal changes, proration changes, cancel toggle,
          // plan switches, etc.) just sync DB state.
          // IMPORTANT: do NOT mint or burn credits here. Subscription credit
          // mutations only happen on `invoice.payment_succeeded` (renewals)
          // and `customer.subscription.deleted` (final teardown).
          const currentPeriodEndUnix =
            subscription.items.data[0]?.current_period_end ||
            (subscription as any).current_period_end; // fallback just in case

          await prisma.user.update({
            where: { id: user.id },
            data: {
              stripeSubscriptionId: subscription.id,
              stripePriceId: subscription.items.data[0].price.id,
              isActive: ["active", "trialing"].includes(subscription.status),
              stripeCurrentPeriodEnd: currentPeriodEndUnix
                ? new Date(currentPeriodEndUnix * 1000)
                : null,
              plan: planName,
              status: subscription.status,
              isCancelled: !!subscription.cancel_at_period_end,
            },
          });

          // Optional: keep Clerk plan in sync if you want
          // (I usually only set plan on payment_succeeded, but keeping it here is fine)
          await clerkClient.users.updateUserMetadata(user.clerkId, {
            unsafeMetadata: {
              plan: ["active", "trialing"].includes(subscription.status)
                ? planName
                : "free",
            },
          });

          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;

          const user = await prisma.user.findFirst({
            where: {
              stripeSubscriptionId: subscription.id,
            },
          });

          // No user points at this subscription. Expected after a plan
          // upgrade: the user row was repointed to the NEW subscription
          // before the old one was cancelled, so this `deleted` event is
          // stale teardown noise. Ack it — throwing would make Stripe retry
          // forever, and matching by customer instead would wipe the new
          // plan's freshly minted credits.
          if (!user) {
            console.warn(
              `subscription.deleted for ${subscription.id}: no user references it (likely superseded by an upgrade) — ignoring`,
            );
            break;
          }

          // Subscription is gone — kill subscription grants. Top-up balances
          // (TOP_UP / PROMOTION / REFUND grants) survive.
          await expireSubscriptionGrants(
            user.id,
            `subscription:${user.plan ?? "free"}:deleted`,
          );

          await prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              isActive: false,
              stripeSubscriptionId: null,
              stripePriceId: null,
              stripeCurrentPeriodEnd: null,
              plan: "free",
              status: subscription.status,
              isCancelled: true,
            },
          });

          await clerkClient.users.updateUserMetadata(user.clerkId, {
            unsafeMetadata: {
              plan: "free",
            },
          });

          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;

          // IMPORTANT: ignore invoices that are not subscription-related.
          // We accept:
          //   - subscription_create : first invoice when sub is created
          //   - subscription_cycle  : monthly / yearly renewal
          //   - subscription_update : plan switch, trial ended early, etc.
          // We do NOT accept:
          //   - manual / subscription_threshold / quote_accept / etc.
          const billingReason = invoice.billing_reason;
          const shouldResetCredits =
            billingReason === "subscription_create" ||
            billingReason === "subscription_cycle" ||
            billingReason === "subscription_update";

          // Retrieve subscription (use invoice.subscription if available)
          const subscriptionId =
            (invoice.lines?.data[0]?.subscription as string) ||
            (invoice.parent?.subscription_details?.subscription as string);

          if (!subscriptionId) break;

          const subscription = await stripe.subscriptions.retrieve(
            subscriptionId,
            {
              expand: ["items.data.price.product"],
            },
          );

          const planName = (
            subscription.items.data[0].price.product as Stripe.Product
          ).name;

          const user = await prisma.user.findFirst({
            where: { stripeCustomerId: subscription.customer as string },
          });
          
          if (!user) throw new Error("User not found");

          const periodEnd = new Date(
            subscription.items.data[0].current_period_end * 1000,
          );

          await prisma.user.update({
            where: { id: user.id },
            data: {
              stripeSubscriptionId: subscription.id,
              stripePriceId: subscription.items.data[0].price.id,
              stripeCurrentPeriodEnd: periodEnd,
              isActive: true,
              plan: planName,
              status: subscription.status,
              isCancelled: false,
            },
          });

          // Plan-upgrade detection: the upgrade checkout stamps the OLD
          // subscription id onto the NEW subscription's metadata. On the new
          // sub's first invoice we carry the old plan's remaining credits
          // over into the new bucket, then cancel the old subscription.
          const upgradeFromSubscriptionId =
            subscription.metadata?.upgradeFromSubscriptionId;
          const isPlanUpgrade =
            billingReason === "subscription_create" &&
            !!upgradeFromSubscriptionId &&
            upgradeFromSubscriptionId !== subscription.id;

          if (shouldResetCredits) {
            const isTrial = subscription.status === "trialing";
            const credits = await planCreditsFor({
              stripePriceId: subscription.items.data[0].price.id,
              planName,
              isTrial,
            });

            // Webhook idempotency: Stripe retries on 5xx / network errors.
            // We key on `invoice.id` because each cycle (and each retry of
            // the same cycle) carries the same invoice id. Without this, a
            // retry would call `expireSubscriptionGrants` again — wiping
            // any credits the user already spent on the just-granted bucket
            // — and then mint a brand new grant.
            const idempotencyReason = `subscription:${planName.toLowerCase()}:${
              isTrial ? "trial" : (billingReason ?? "cycle")
            }:${invoice.id}`;

            const alreadyProcessed = await prisma.creditGrant.findFirst({
              where: { userId: user.id, reason: idempotencyReason },
              select: { id: true },
            });

            if (!alreadyProcessed) {
              // Snapshot the old plan's leftover subscription credits BEFORE
              // the rollover expires them — on an upgrade they roll into the
              // new plan's bucket instead of being lost.
              const carryover = isPlanUpgrade
                ? await getSubscriptionCreditsRemaining(user.id)
                : 0;

              if (credits + carryover > 0) {
                await rolloverSubscriptionCycle({
                  userId: user.id,
                  amount: credits + carryover,
                  expiresAt: periodEnd,
                  reason: idempotencyReason,
                  metadata: {
                    stripeSubscriptionId: subscription.id,
                    stripeInvoiceId: invoice.id,
                    billingReason,
                    trial: isTrial,
                    ...(isPlanUpgrade
                      ? {
                          planUpgrade: true,
                          upgradeFromSubscriptionId,
                          planCredits: credits,
                          carryoverCredits: carryover,
                        }
                      : {}),
                  },
                });
              } else {
                await expireSubscriptionGrants(
                  user.id,
                  `subscription:${planName.toLowerCase()}:zero-credit-plan:${invoice.id}`,
                );
              }
            }
          }

          // Upgrade teardown: cancel the superseded subscription. Runs on
          // every retry (outside the grant idempotency guard) so a failed
          // cancel is re-attempted; cancelling an already-canceled sub just
          // throws, which we swallow. IMPORTANT: this must happen AFTER the
          // user row above was repointed to the new subscription — the
          // resulting `customer.subscription.deleted` webhook looks the user
          // up by the OLD sub id, misses, and acks without touching the new
          // credits.
          if (isPlanUpgrade) {
            try {
              const oldSub = await stripe.subscriptions.retrieve(
                upgradeFromSubscriptionId,
              );
              if (oldSub.status !== "canceled") {
                await stripe.subscriptions.cancel(upgradeFromSubscriptionId, {
                  prorate: false,
                });
              }
            } catch (err) {
              console.error(
                `Failed to cancel superseded subscription ${upgradeFromSubscriptionId}:`,
                err,
              );
            }
          }

          await clerkClient.users.updateUserMetadata(user.clerkId, {
            unsafeMetadata: {
              onboardingCompleted: true,
              plan: planName,
            },
          });

          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as unknown as Stripe.Invoice;

          // Use the same multi-source lookup as `invoice.payment_succeeded`
          // — `invoice.parent.subscription_details.subscription` is a newer
          // API field that may not be present on every invoice, so fall
          // back to `invoice.lines.data[0].subscription`.
          const subscriptionId =
            (invoice.lines?.data[0]?.subscription as string) ||
            (invoice.parent?.subscription_details?.subscription as string);

          if (!subscriptionId) {
            break;
          }

          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);

          const user = await prisma.user.findFirst({
            where: {
              stripeCustomerId: subscription.customer as string,
            },
          });

          if (!user) {
            throw new Error("User not found");
          }

          await expireSubscriptionGrants(
            user.id,
            `subscription:${user.plan ?? "free"}:payment-failed:${invoice.id}`,
          );

          await prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              isActive: false,
              plan: "free",
              status: subscription.status,
              isCancelled: true,
            },
          });

          break;
        }

        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;

          // Only handle one-time payments here. Subscription checkout sessions
          // are picked up by `invoice.payment_succeeded` above (which already
          // grants subscription credits via rolloverSubscriptionCycle).
          if (session.mode !== "payment") break;
          if (session.payment_status !== "paid") break;

          // We allow the checkout flow to declare how many credits this
          // top-up is worth via session metadata. Set this when creating the
          // checkout session, e.g.:
          //   stripe.checkout.sessions.create({
          //     mode: "payment",
          //     metadata: { userId, topupCredits: "200" },
          //     ...
          //   })
          const topupAmount = parseInt(
            (session.metadata?.topupCredits as string | undefined) ?? "",
            10,
          );
          const userIdFromMeta = session.metadata?.userId as string | undefined;
          if (!Number.isFinite(topupAmount) || topupAmount <= 0) break;

          let userId = userIdFromMeta;
          if (!userId && session.customer) {
            const found = await prisma.user.findFirst({
              where: { stripeCustomerId: session.customer as string },
              select: { id: true },
            });
            userId = found?.id;
          }
          if (!userId) {
            break;
          }

          const topupReason = `topup:${session.id}`;
          const alreadyGranted = await prisma.creditGrant.findFirst({
            where: { userId, reason: topupReason },
            select: { id: true },
          });
          if (alreadyGranted) {
            break;
          }

          await grantCredits({
            userId,
            amount: topupAmount,
            source: "TOP_UP",
            reason: topupReason,
            expiresAt: null, // top-ups never expire
            metadata: {
              stripeCheckoutSessionId: session.id,
              stripePaymentIntent:
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : (session.payment_intent?.id ?? null),
              amountTotal: session.amount_total,
              currency: session.currency,
            },
          });

          break;
        }

        case "radar.early_fraud_warning.created": {
          const fraudWarning = event.data
            .object as Stripe.Radar.EarlyFraudWarning;
          const chargeId = fraudWarning.charge as string;

          // Refund the charge
          await stripe.refunds.create({ charge: chargeId });

          // Get the charge details to find customer
          const charge = await stripe.charges.retrieve(chargeId);
          const customerId = charge.customer as string;

          // Find the user before mutating credits (we need their id).
          const fraudUser = await prisma.user.findUnique({
            where: { stripeCustomerId: customerId },
            select: { id: true, plan: true },
          });

          if (fraudUser) {
            // Burn ALL grants — fraud means we want zero balance, including
            // any top-ups they may have purchased on the same card.
            await prisma.creditTransaction.create({
              data: {
                userId: fraudUser.id,
                type: "EXPIRY",
                amount: -(
                  (
                    await prisma.creditGrant.aggregate({
                      where: {
                        userId: fraudUser.id,
                        OR: [
                          { expiresAt: null },
                          { expiresAt: { gt: new Date() } },
                        ],
                      },
                      _sum: { amount: true, used: true },
                    })
                  )._sum.amount! ?? 0
                ),
                reason: `fraud:${chargeId}`,
                metadata: { chargeId, customerId },
              },
            });
            await prisma.creditGrant.updateMany({
              where: {
                userId: fraudUser.id,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
              data: { expiresAt: new Date() },
            });
          }

          await prisma.user.update({
            where: {
              stripeCustomerId: customerId,
            },
            data: {
              isActive: false,
              plan: "free",
              stripeSubscriptionId: null,
              stripePriceId: null,
              stripeCurrentPeriodEnd: null,
              status: "canceled",
              isCancelled: true,
            },
          });

          // Delete the customer from Stripe
          await stripe.customers.del(customerId);
          break;
        }
      }

      return res.json({ received: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
      return res
        .status(500)
        .json({ success: false, error: "Webhook processing failed" });
    }
  }

  async generateCheckoutSession(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;
      // Preferred: the client sends a stable plan `key` ("basic" | "pro" |
      // "power") and we resolve the Stripe Price ID server-side from the
      // `plans` table. `priceId` is a transitional fallback so an older
      // client mid-deploy keeps working — remove it once every client sends
      // `key`.
      const { key, priceId: priceIdFromClient } = req.body as {
        key?: string;
        priceId?: string;
      };

      let priceId = priceIdFromClient;
      if (key) {
        const plan = await getPlanByKey(key);
        if (
          !plan ||
          plan.type !== "SUBSCRIPTION" ||
          !plan.isActive ||
          !plan.stripePriceId
        ) {
          return res
            .status(400)
            .json({ error: "Unknown or unavailable plan" });
        }
        priceId = plan.stripePriceId;
      }

      if (!priceId) {
        return res.status(400).json({ error: "Missing plan selection" });
      }

      const clerkUser = await clerkClient.users.getUser(clerkId);
      const email = clerkUser.emailAddresses[0].emailAddress;

      const user = await prisma.user.findUnique({
        where: { clerkId },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Check if user has had a previous subscription
      let hasPreviousSubscription = false;

      if (user.stripeCustomerId) {
        try {
          const invoices = await stripe.invoices.list({
            customer: user.stripeCustomerId,
            status: "paid",
            limit: 1,
          });
          hasPreviousSubscription = invoices.data.length > 0;
        } catch (error) {
          console.error("Error checking previous payments:", error);
        }
      }

      // Defense in depth: if the user ALREADY has a live subscription, this
      // checkout is really a plan switch — without this, paying would leave
      // them with TWO subscriptions and no credit carryover. Stamp the same
      // upgrade metadata `upgradePlan` uses so the webhook cancels the old
      // sub and carries remaining credits over, regardless of which client
      // path led here.
      let upgradeFromSubscriptionId: string | null = null;
      if (user.stripeSubscriptionId) {
        try {
          const current = await stripe.subscriptions.retrieve(
            user.stripeSubscriptionId,
          );
          if (["active", "trialing"].includes(current.status)) {
            if (current.items.data[0]?.price.id === priceId) {
              return res
                .status(400)
                .json({ error: "You are already on this plan" });
            }
            upgradeFromSubscriptionId = user.stripeSubscriptionId;
          }
        } catch (error) {
          console.error("Error checking current subscription:", error);
        }
      }

      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        success_url: SUCCESS_URL,
        cancel_url: CANCEL_URL,
        payment_method_types: ["card"],
        billing_address_collection: "auto",
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        allow_promotion_codes: true,
        metadata: {
          userId: user.id,
        },
        subscription_data: upgradeFromSubscriptionId
          ? {
              metadata: {
                userId: user.id,
                kind: "plan_upgrade",
                upgradeFromSubscriptionId,
              },
            }
          : !hasPreviousSubscription
            ? {
                trial_period_days: 3,
              }
            : undefined,
        custom_text: {
          submit: {
            message: upgradeFromSubscriptionId
              ? "Your current plan will be cancelled and any remaining plan credits will be added to your new plan."
              : "Your subscription will begin immediately after successful payment.",
          },
        },
      };

      // If we have an existing subscription, use the customer ID
      if (user.stripeCustomerId) {
        sessionConfig.customer = user.stripeCustomerId;
      } else {
        // Otherwise, just pass the email
        sessionConfig.customer_email = email;
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      return res.status(500).json({
        error: "Failed to create checkout session",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Start a plan switch (upgrade/downgrade) for a user who already has a
   * subscription.
   *
   * Flow (cancel-old + create-new, NOT an in-place price swap):
   *   1. Validate the target plan and that it differs from the current one.
   *   2. Open a subscription-mode Checkout for the NEW plan at full price,
   *      with `upgradeFromSubscriptionId` stamped on the new subscription's
   *      metadata. Nothing changes until the user actually pays.
   *   3. The `invoice.payment_succeeded` webhook sees that metadata on the
   *      new sub's first invoice, carries the old plan's remaining
   *      subscription credits into the new plan's bucket
   *      (newPlanCredits + carryover, one grant, keyed on the invoice id),
   *      and cancels the old subscription in Stripe.
   *
   * If the user abandons checkout, the old subscription is untouched.
   */
  async upgradePlan(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;
      const { key } = req.body as { key?: string };

      if (!key || typeof key !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "Missing plan `key`" });
      }

      const user = await prisma.user.findUnique({ where: { clerkId } });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }
      if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
        return res.status(400).json({
          success: false,
          error:
            "No existing subscription to upgrade from. Use the regular checkout instead.",
        });
      }

      const plan = await getPlanByKey(key);
      if (
        !plan ||
        plan.type !== "SUBSCRIPTION" ||
        !plan.isActive ||
        !plan.stripePriceId
      ) {
        return res
          .status(400)
          .json({ success: false, error: "Unknown or unavailable plan" });
      }

      // Pull the live subscription so we don't act on stale DB state.
      const current = await stripe.subscriptions.retrieve(
        user.stripeSubscriptionId,
      );
      if (!["active", "trialing"].includes(current.status)) {
        return res.status(400).json({
          success: false,
          error:
            "Your current subscription is not active. Use the regular checkout instead.",
        });
      }
      if (current.items.data[0]?.price.id === plan.stripePriceId) {
        return res
          .status(400)
          .json({ success: false, error: "You are already on this plan" });
      }

      const billingBase = CLIENT_URL ? `${CLIENT_URL}/billing` : SUCCESS_URL;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: user.stripeCustomerId,
        success_url: billingBase
          ? `${billingBase}?upgrade=success&plan=${plan.key}`
          : SUCCESS_URL,
        cancel_url: billingBase ? `${billingBase}?upgrade=cancel` : CANCEL_URL,
        payment_method_types: ["card"],
        billing_address_collection: "auto",
        allow_promotion_codes: true,
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        metadata: { userId: user.id, kind: "plan_upgrade" },
        // No trial — this is a paid-to-paid switch, charged in full now.
        // CRITICAL: `upgradeFromSubscriptionId` drives the webhook's credit
        // carryover + old-sub cancellation. Do not rename it without
        // updating `handleWebhook` → `invoice.payment_succeeded`.
        subscription_data: {
          metadata: {
            userId: user.id,
            kind: "plan_upgrade",
            upgradeFromSubscriptionId: user.stripeSubscriptionId,
          },
        },
        custom_text: {
          submit: {
            message:
              "Your current plan will be cancelled and any remaining plan credits will be added to your new plan.",
          },
        },
      });

      return res.json({ success: true, url: session.url });
    } catch (error) {
      console.error("Error creating upgrade checkout session:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to start plan upgrade",
      });
    }
  }

  /**
   * Convert the user's currently-trialing subscription into a paid one
   * IMMEDIATELY (single Stripe API call, single subscription ID).
   *
   * Why not cancel + create? Two separate webhooks (`subscription.deleted`
   * for the old + `invoice.payment_succeeded` for the new) are not
   * order-guaranteed by Stripe. If `deleted` lands AFTER the new invoice,
   * `expireSubscriptionGrants` would wipe the freshly minted paid bucket.
   *
   * Instead we end the trial in place via `trial_end: "now"`. Stripe then
   * issues exactly one invoice (`billing_reason: "subscription_update"`)
   * which our webhook turns into a real plan grant via
   * `rolloverSubscriptionCycle`. The trial bucket is wiped by the same
   * call's internal `expireSubscriptionGrants`.
   *
   * The response is intentionally optimistic — actual credits are minted
   * by the webhook. The client should re-fetch the balance after a short
   * delay (or when its existing webhook-driven UI refresh fires).
   */
  async getPaidSubscription(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;

      const user = await prisma.user.findUnique({
        where: { clerkId },
      });

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      if (!user.stripeCustomerId)
        return res
          .status(400)
          .json({ success: false, error: "No Stripe customer found" });
      if (!user.stripeSubscriptionId)
        return res
          .status(400)
          .json({
            success: false,
            error: "No active trial subscription to upgrade",
          });

      // Pull the live subscription so we don't act on stale DB state.
      const current = await stripe.subscriptions.retrieve(
        user.stripeSubscriptionId,
        { expand: ["items.data.price.product"] },
      );

      if (current.status !== "trialing") {
        return res
          .status(400)
          .json({
            success: false,
            error: "Subscription is not in a trial period",
          });
      }

      const paymentMethods = await stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: "card",
      });
      const paymentMethod = paymentMethods.data[0];
      if (!paymentMethod) {
        return res.status(400).json({
          success: false,
          error:
            "No saved payment method. Please add a card before upgrading.",
        });
      }

      const priceId = current.items.data[0].price.id;
      const planName = (current.items.data[0].price.product as Stripe.Product)
        .name;

      // End the trial in place. Stripe will immediately invoice the customer
      // for the new billing period.
      //
      // We expand `latest_invoice` so we can use the invoice id as a shared
      // idempotency key with the webhook handler — whichever runs first
      // (this controller or the `invoice.payment_succeeded` webhook) wins,
      // and the other becomes a no-op.
      const subscription = await stripe.subscriptions.update(
        user.stripeSubscriptionId,
        {
          trial_end: "now",
          default_payment_method: paymentMethod.id,
          proration_behavior: "none",
          payment_settings: {
            payment_method_types: ["card"],
            save_default_payment_method: "on_subscription",
          },
          expand: ["latest_invoice"],
        },
      );

      // ---- Grant the FULL paid-plan credits inline ----
      //
      // Why not rely solely on the webhook? `trial_end: "now"` causes Stripe
      // to issue an invoice whose `billing_reason` may come through as
      // `subscription_update` (depending on API version), which the webhook's
      // `shouldResetCredits` filter does NOT include. Granting here makes the
      // upgrade deterministic; the webhook's idempotency check on
      // `invoice.id` ensures we never double-grant if it ALSO matches.
      const fullPlanCredits = await planCreditsFor({
        stripePriceId: priceId,
        planName,
        isTrial: false,
      });

      const latestInvoice =
        typeof subscription.latest_invoice === "string"
          ? null
          : (subscription.latest_invoice as Stripe.Invoice | null);

      // Mirror the webhook's reason format so both code paths key on the
      // same value and the existence check short-circuits a second grant.
      const invoiceId = latestInvoice?.id ?? `upgrade-${subscription.id}`;
      const billingReason =
        latestInvoice?.billing_reason ?? "subscription_update";
      const idempotencyReason = `subscription:${planName.toLowerCase()}:${billingReason}:${invoiceId}`;

      const periodEndUnix =
        subscription.items.data[0]?.current_period_end ||
        (subscription as any).current_period_end;
      const periodEnd = periodEndUnix
        ? new Date(periodEndUnix * 1000)
        : // Defensive fallback — if Stripe didn't return a period end (it
          // always should), pick 30 days out so the grant still expires
          // eventually rather than living forever.
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const alreadyGranted = await prisma.creditGrant.findFirst({
        where: { userId: user.id, reason: idempotencyReason },
        select: { id: true },
      });

      if (!alreadyGranted) {
        if (fullPlanCredits > 0) {
          // Wipes the trial bucket then mints the full paid bucket.
          await rolloverSubscriptionCycle({
            userId: user.id,
            amount: fullPlanCredits,
            expiresAt: periodEnd,
            reason: idempotencyReason,
            metadata: {
              stripeSubscriptionId: subscription.id,
              stripeInvoiceId: latestInvoice?.id ?? null,
              billingReason,
              source: "trial-upgrade",
            },
          });
        } else {
          // No credits configured for this plan — at least kill the trial
          // bucket so the user isn't left with mismatched credits.
          await expireSubscriptionGrants(
            user.id,
            `subscription:${planName.toLowerCase()}:upgrade-no-credits:${invoiceId}`,
          );
        }
      }

      // Sync the user row eagerly too — the webhook will also do this, but
      // doing it here means the next page load reflects "active" immediately.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          stripeCurrentPeriodEnd: periodEnd,
          isActive: true,
          plan: planName,
          status: subscription.status,
          isCancelled: false,
        },
      });

      try {
        await clerkClient.users.updateUserMetadata(user.clerkId, {
          unsafeMetadata: { onboardingCompleted: true, plan: planName },
        });
      } catch (err) {
        console.error("Failed to sync Clerk metadata after upgrade:", err);
      }

      return res.status(200).json({
        success: true,
        message: "Trial upgraded to paid subscription",
        subscription: {
          id: subscription.id,
          status: subscription.status,
          plan: planName,
          priceId,
          credits: fullPlanCredits,
        },
      });
    } catch (error) {
      console.error("Error upgrading trial to paid subscription:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to process subscription upgrade" });
    }
  }

  async cancelTrial(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { clerkId },
      });

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      if (!user.stripeSubscriptionId) {
        return res
          .status(400)
          .json({ success: false, error: "No active subscription found" });
      }

      if (user.status !== "trialing") {
        return res
          .status(400)
          .json({ success: false, error: "No active trial found" });
      }

      // Cancel the subscription in Stripe
      await stripe.subscriptions.cancel(user.stripeSubscriptionId);

      await expireSubscriptionGrants(
        user.id,
        `subscription:${user.plan ?? "free"}:trial-cancelled`,
      );

      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          status: "canceled",
          isActive: false,
          isCancelled: true,
          stripeCurrentPeriodEnd: new Date(),
        },
      });

      return res.status(200).json({
        message: "Trial cancelled successfully",
        subscription: {
          status: "canceled",
          isActive: false,
          isCancelled: true,
        },
      });
    } catch (error) {
      console.error("Error canceling trial:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to cancel trial" });
    }
  }

  async getBillingPortalUrl(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;
      const user = await prisma.user.findUnique({
        where: { clerkId },
      });

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      if (!user.stripeCustomerId) {
        return res
          .status(400)
          .json({ success: false, error: "No Stripe customer ID found" });
      }

      // Create billing portal session
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: SUCCESS_URL, // Return to your app after managing billing
      });

      res.json({ url: portalSession.url });
    } catch (error) {
      console.error("Error getting billing portal URL:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to create billing portal session" });
    }
  }

  /**
   * Returns the catalog of one-time credit top-up packs. The client renders
   * this on the billing page; pricing/credits are server-controlled so a
   * tampered request can't get a discount.
   *
   * Source of truth = `plans` table where `type = TOPUP AND isActive = true`.
   * Edit those rows (admin panel or psql) to change what's offered.
   */
  /**
   * Returns the catalog of subscription tiers (basic / pro / power). The
   * billing page + upgrade modal render this instead of hardcoding plan
   * names, prices, and credits on the client.
   *
   * Source of truth = `plans` table where `type = SUBSCRIPTION AND
   * isActive = true`. The Stripe Price ID is deliberately NOT exposed —
   * checkout resolves it from `key` server-side, so it never touches the
   * browser and can't be tampered with.
   */
  async getSubscriptionPlans(_req: Request, res: Response) {
    try {
      const plans = await listSubscriptionPlans();
      const data = plans.map((p) => {
        const pub = toPublicPlan(p);
        return {
          key: pub.key,
          name: pub.name,
          description: pub.description ?? undefined,
          credits: pub.credits,
          priceUsd: pub.priceUsd,
          isPopular: pub.isPopular,
          sortOrder: pub.sortOrder,
        };
      });
      return res.json({ success: true, data });
    } catch (error) {
      console.error("Error listing subscription plans:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load subscription plans" });
    }
  }

  async listCreditPacks(_req: Request, res: Response) {
    try {
      const plans = await listTopupPlans();
      // Map to the legacy `{ key, name, credits, priceUsd, ... }` shape the
      // client billing page already understands. New consumers should use
      // `toPublicPlan` directly.
      const data = plans.map((p) => {
        const pub = toPublicPlan(p);
        return {
          key: pub.key,
          name: pub.name,
          credits: pub.credits,
          priceUsd: pub.priceUsd,
          description: pub.description ?? undefined,
          popular: pub.isPopular,
        };
      });
      return res.json({ success: true, data });
    } catch (error) {
      console.error("Error listing credit packs:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load credit packs" });
    }
  }

  /**
   * Create a Stripe Checkout Session for a one-time credit top-up.
   *
   * Flow:
   *   1. Client POSTs `{ packKey }`.
   *   2. We resolve the pack server-side (price + credits).
   *   3. Open a `mode: "payment"` Checkout Session with metadata:
   *        - `userId`         : our internal user id
   *        - `topupCredits`   : how many credits to grant on success
   *        - `packKey`        : audit trail
   *   4. On payment success, the existing `checkout.session.completed`
   *      webhook in `handleWebhook` reads `topupCredits` and calls
   *      `grantCredits({ source: "TOP_UP", expiresAt: null, ... })`.
   *
   * Top-up credits never expire — they're consumed AFTER any active
   * subscription credits (FIFO by `expiresAt`).
   */
  async createTopupCheckoutSession(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;
      const { packKey } = req.body as { packKey?: string };

      if (!packKey || typeof packKey !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "Missing `packKey`" });
      }

      const pack = await getTopupPlan(packKey);
      
      if (!pack) {
        return res
          .status(400)
          .json({ success: false, error: `Unknown pack: ${packKey}` });
      }

      const user = await prisma.user.findUnique({ where: { clerkId } });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      // Top-ups are an add-on for paying customers only — they don't make
      // sense without an active plan and we don't want them to be the
      // backdoor that lets free users buy credits piecemeal. Mirrors the
      // `isPaid` gate in the billing UI; this is the source of truth.
      const hasActiveSubscription =
        user.isActive &&
        !!user.stripeSubscriptionId &&
        (user.plan ?? "free").toLowerCase() !== "free";

      if (!hasActiveSubscription) {
        return res.status(403).json({
          success: false,
          error:
            "Credit top-ups are only available on an active subscription. Please subscribe to a plan first.",
        });
      }

      // Build return URLs. Prefer the explicit CLIENT_URL env (so we land
      // back on the billing page with a status flag); otherwise fall back to
      // the generic STRIPE_SUCCESS_URL/STRIPE_CANCEL_URL.
      const billingBase = CLIENT_URL ? `${CLIENT_URL}/billing` : SUCCESS_URL;
      const successUrl = billingBase
        ? `${billingBase}?topup=success&credits=${pack.credits}&pack=${pack.key}`
        : SUCCESS_URL;
      const cancelUrl = billingBase
        ? `${billingBase}?topup=cancel`
        : CANCEL_URL;

      const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = {
        quantity: 1,
        // Prefer a pre-created Stripe Price if the Plan row references one
        // (cleaner reporting in the Stripe dashboard); otherwise fall back
        // to inline `price_data` using the row's priceCents.
        ...(pack.stripePriceId
          ? { price: pack.stripePriceId }
          : {
              price_data: {
                currency: pack.currency,
                unit_amount: pack.priceCents,
                product_data: {
                  name: `${pack.name} — ${pack.credits.toLocaleString()} credits`,
                  description:
                    pack.description ??
                    `${pack.credits.toLocaleString()} credits, never expire`,
                  metadata: {
                    packKey: pack.key,
                    credits: String(pack.credits),
                  },
                },
              },
            }),
      };

      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_method_types: ["card"],
        billing_address_collection: "auto",
        allow_promotion_codes: true,
        line_items: [lineItem],
        // CRITICAL: these two fields drive the webhook handler in
        // `handleWebhook` → `checkout.session.completed`. Do not rename them
        // without updating the webhook too.
        metadata: {
          userId: user.id,
          topupCredits: String(pack.credits),
          packKey: pack.key,
        },
        // Mirror the metadata onto the underlying PaymentIntent so it's
        // visible in Stripe → Payments without drilling into the Checkout
        // Session.
        payment_intent_data: {
          metadata: {
            userId: user.id,
            topupCredits: String(pack.credits),
            packKey: pack.key,
            kind: "credit_topup",
          },
        },
      };

      // Reuse an existing Stripe customer when we have one so the user keeps
      // a single payment-method history.
      if (user.stripeCustomerId) {
        sessionConfig.customer = user.stripeCustomerId;
      } else {
        sessionConfig.customer_email = user.email;
        sessionConfig.customer_creation = "always";
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);
      return res.json({ success: true, url: session.url });
    } catch (error) {
      console.error("Error creating top-up checkout session:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to create checkout session" });
    }
  }

  async getUserSubscription(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;

      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: {
          stripeSubscriptionId: true,
          stripeCustomerId: true,
          stripePriceId: true,
          stripeCurrentPeriodEnd: true,
          isActive: true,
          plan: true,
          status: true,
          isCancelled: true,
        },
      });

      if (!user) {
        return res.json({
          isActive: false,
          priceId: null,
          currentPeriodEnd: null,
          stripeSubscriptionId: null,
          stripeCustomerId: null,
          plan: "free",
          status: "inactive",
          isCancelled: false,
        });
      }

      res.json(user);
    } catch (error) {
      console.error("Error getting subscription details:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch subscription details",
      });
    }
  }
}
