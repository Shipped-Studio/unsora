"use client";

import { useState } from "react";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useCreditPlans } from "@/hooks/use-credit-plans";
import { hasCreditPlan, useUserUsage } from "@/hooks/use-user-usage";
import { CardGridSkeleton, CreditPlanCard, cardGridClass, cardItemClass } from "./pricing-cards";
import { redirectToStripe } from "./redirect-to-stripe";

/**
 * Picking a Monthly credits tier: the tiers, what the buttons say and the
 * checkout. Independent of the scheduler plan. No free trial. A subscriber
 * picking another tier switches: the new one is paid now, the old one ends
 * and its unused credits for the month come along.
 *
 * `returnPath` brings Stripe back to an in-app page (onboarding); without
 * it, Billing.
 */
export function useCreditPlanChoice(returnPath?: string) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const { authFetch } = useAuthFetch();
  const { usage } = useUserUsage();
  const { plans, loading, error, refetch } = useCreditPlans();

  const subscription = usage?.creditSubscription ?? null;
  const subscribed = hasCreditPlan(usage);
  const pastDue = subscribed && subscription?.status === "past_due";
  const currentKey = subscribed ? (subscription?.planKey ?? null) : null;
  const current = plans?.find((p) => p.key === currentKey) ?? null;

  const handleSelect = async (planKey: string) => {
    setPendingKey(planKey);
    const redirecting = await redirectToStripe(
      authFetch("/api/stripe/create-credits-subscription-session", {
        method: "POST",
        body: JSON.stringify({ key: planKey, ...(returnPath ? { returnPath } : {}) }),
      }),
      "Couldn't start checkout",
    );
    if (!redirecting) setPendingKey(null);
  };

  const description = subscribed
    ? "Switching starts the new plan today. Credits you haven't used this month move to it."
    : "Credits every month for clipping and AI. Unused monthly credits don't roll over; top-ups never expire.";

  return {
    plans,
    loading,
    error,
    refetch,
    subscribed,
    pastDue,
    currentKey,
    currentPrice: current?.priceUsd ?? 0,
    pendingKey,
    handleSelect,
    description,
  };
}

export type CreditPlanChoice = ReturnType<typeof useCreditPlanChoice>;

/** The Monthly credits cards, with their loading, error and empty states. */
export function CreditPlanGrid({ choice }: { choice: CreditPlanChoice }) {
  const { plans, loading, error, refetch, subscribed, pastDue, currentKey, currentPrice, pendingKey, handleSelect } =
    choice;

  if (loading) return <CardGridSkeleton />;
  if (error) {
    return (
      <ErrorState title="Couldn't load monthly credit plans" description={error} onRetry={() => void refetch()} />
    );
  }
  if (!plans?.length) {
    return <EmptyState title="No monthly credit plans right now" description="Check back in a few minutes." />;
  }

  return (
    <ul className={cardGridClass(plans.length)}>
      {plans.map((plan) => {
        const isCurrent = plan.key === currentKey;
        const popular = Boolean(plan.isPopular);
        const label = !subscribed
          ? `Subscribe to ${plan.name}`
          : plan.priceUsd > currentPrice
            ? `Upgrade to ${plan.name}`
            : `Switch to ${plan.name}`;

        return (
          <li key={plan.key} className={cardItemClass(plans.length)}>
            <CreditPlanCard
              plan={plan}
              highlight={popular}
              badge={isCurrent ? "Current plan" : popular ? "Popular" : undefined}
              badgeTone={isCurrent ? "plain" : "lime"}
              action={
                isCurrent
                  ? null
                  : {
                      label,
                      onClick: () => void handleSelect(plan.key),
                      pending: pendingKey === plan.key,
                      // A failing payment has to be fixed before a switch.
                      disabled: pendingKey !== null || pastDue,
                    }
              }
              idleLabel="You're on this plan"
            />
          </li>
        );
      })}
    </ul>
  );
}
