"use client";

import { useState } from "react";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { findUserPlan, useSubscriptionPlans, useTrialDays } from "@/hooks/use-subscription-plans";
import { useUserUsage } from "@/hooks/use-user-usage";
import { PostToRow } from "./post-to-row";
import { CardGridSkeleton, PlanCard, cardGridClass, cardItemClass } from "./pricing-cards";
import { redirectToStripe } from "./redirect-to-stripe";

/**
 * Picking a plan: which plans to offer, what the buttons say and starting the
 * checkout. Shared by the pricing dialog and the Billing page, which show
 * them through PlanGrid. `enabled` gates the trial check, which asks Stripe.
 */
export function usePlanChoice(enabled: boolean) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const { authFetch } = useAuthFetch();
  const { usage } = useUserUsage();
  const { plans, loading, error, refetch } = useSubscriptionPlans();
  const trialDays = useTrialDays(enabled);

  const currentPlan = findUserPlan(plans, usage?.user.plan);
  const currentKey = currentPlan?.key ?? (usage?.user.plan ?? "free").toLowerCase();
  const isPaid = usage?.user.isActive === true && currentKey !== "free";
  const currentPrice = currentPlan?.priceUsd ?? 0;
  // Plans on sale, plus a subscriber's own plan if it's no longer sold.
  const shown =
    plans?.filter((p) => p.available !== false || (isPaid && p.key === currentKey)) ?? null;

  const handleSelect = async (planKey: string) => {
    setPendingKey(planKey);
    // Subscribers switch plans (old subscription cancelled once the new one
    // is paid, plan credits carried over); everyone else starts a checkout.
    const endpoint = isPaid
      ? "/api/stripe/upgrade-plan"
      : "/api/stripe/create-checkout-session";
    const redirecting = await redirectToStripe(
      authFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ key: planKey }),
      }),
      "Couldn't start checkout",
    );
    if (!redirecting) setPendingKey(null);
  };

  const description = isPaid
    ? currentPlan?.credits
      ? "Your current subscription ends once the new plan is paid. The new plans don't add credits each month: the credits you have now stay, and you can buy more as top-ups."
      : "Your current subscription ends once the new plan is paid. Your credits stay as they are."
    : trialDays
      ? `Every plan starts with a ${trialDays}-day free trial. Cancel any time before it ends from Billing and you won't be charged.`
      : "Plans renew automatically. You can cancel any time from Billing.";

  return {
    shown,
    loading,
    error,
    refetch,
    trialDays,
    isPaid,
    currentKey,
    currentPrice,
    pendingKey,
    handleSelect,
    description,
  };
}

export type PlanChoice = ReturnType<typeof usePlanChoice>;

/** The plan cards, with their loading, error and empty states. */
export function PlanGrid({ choice }: { choice: PlanChoice }) {
  const {
    shown,
    loading,
    error,
    refetch,
    trialDays,
    isPaid,
    currentKey,
    currentPrice,
    pendingKey,
    handleSelect,
  } = choice;

  if (loading) return <CardGridSkeleton />;
  if (error) {
    return <ErrorState title="Couldn't load plans" description={error} onRetry={() => void refetch()} />;
  }
  if (!shown?.length) {
    return (
      <EmptyState title="No plans available" description="Plans are being updated. Check back in a few minutes." />
    );
  }

  return (
    <div className="space-y-8">
      <PostToRow />
      <ul className={cardGridClass(shown.length)}>
        {shown.map((plan) => {
          const isCurrent = isPaid && plan.key === currentKey;
          const popular = Boolean(plan.isPopular);
          // Offer the trial only when checkout really starts one;
          // returning subscribers pay from day one.
          const offerTrial = !isPaid && Boolean(trialDays);
          const label = !isPaid
            ? offerTrial
              ? "Start free trial"
              : `Choose ${plan.name}`
            : plan.priceUsd > currentPrice
              ? `Upgrade to ${plan.name}`
              : `Switch to ${plan.name}`;

          return (
            <li key={plan.key} className={cardItemClass(shown.length)}>
              <PlanCard
                plan={plan}
                highlight={popular}
                badge={isCurrent ? "Current plan" : popular ? "Popular" : undefined}
                badgeTone={isCurrent ? "plain" : "lime"}
                trialDays={offerTrial ? (trialDays ?? 0) : 0}
                action={
                  isCurrent
                    ? null
                    : {
                        label,
                        onClick: () => void handleSelect(plan.key),
                        pending: pendingKey === plan.key,
                        disabled: pendingKey !== null,
                      }
                }
                idleLabel="You're on this plan"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
