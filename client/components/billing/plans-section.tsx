"use client";

import { PLAN_PRESENTATION } from "@/constant";
import type { SubscriptionPlan } from "@/hooks/use-subscription-plans";
import { PlanCard } from "./plan-card";

interface PlansSectionProps {
  /** Subscription tiers from the DB (`useSubscriptionPlans`). */
  plans: SubscriptionPlan[] | null;
  plansLoading: boolean;
  currentPlanKey: string;
  /** Price (USD/mo) of the current plan, used to label upgrade vs downgrade. */
  currentPrice: number;
  isPaid: boolean | undefined;
  loadingPlanKey: string | null;
  onSelect: (planKey: string) => void;
}

/**
 * The 3-column subscription tier grid (Basic / Pro / Power).
 *
 * Commercial facts (name, price, credits, isPopular) come from the DB `plans`
 * table via `useSubscriptionPlans()` — the same source the webhook uses to
 * grant credits, so the card can never advertise a different amount. Only the
 * marketing feature list + `isBestValue` flag stay client-side, keyed by plan
 * `key` in `PLAN_PRESENTATION`.
 */
export function PlansSection({
  plans,
  plansLoading,
  currentPlanKey,
  currentPrice,
  isPaid,
  loadingPlanKey,
  onSelect,
}: PlansSectionProps) {
  return (
    <div className="mb-8">
      <h2 className="mb-4 text-lg font-semibold">Plans</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {plansLoading && !plans
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-xl border border-border bg-muted/40"
              />
            ))
          : (plans ?? []).map((plan) => {
              const presentation = PLAN_PRESENTATION[plan.key];
              const features = presentation?.features ?? [];
              const isBestValue = presentation?.isBestValue === true;

              return (
                <PlanCard
                  key={plan.key}
                  planKey={plan.key}
                  name={plan.name}
                  description={plan.description ?? ""}
                  price={plan.priceUsd}
                  credits={plan.credits}
                  features={features}
                  isPopular={plan.isPopular === true}
                  isBestValue={isBestValue}
                  isCurrent={currentPlanKey === plan.key}
                  isPaid={isPaid ?? false}
                  currentPrice={currentPrice}
                  isLoading={loadingPlanKey === plan.key}
                  anyLoading={loadingPlanKey !== null}
                  onSelect={onSelect}
                />
              );
            })}
      </div>
    </div>
  );
}
