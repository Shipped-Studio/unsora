"use client";

import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { findUserPlan, useSubscriptionPlans, useTrialDays } from "@/hooks/use-subscription-plans";
import { useUserUsage } from "@/hooks/use-user-usage";
import { cn } from "@/lib/utils";
import { formatUsd, intervalLabel, planAllowanceLabel } from "./format";
import { planCardFeatures } from "./plan-features";
import { redirectToStripe } from "./redirect-to-stripe";

function gridCols(count: number) {
  return count >= 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3";
}

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

  return (
    <>
      {loading ? (
        <div className={cn("grid grid-cols-1 gap-3", gridCols(3))}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} size="sm">
              <CardHeader>
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-40" />
              </CardHeader>
              <CardContent className="gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="mt-3 h-20 w-full" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-9 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Couldn't load plans"
          description={error}
          onRetry={() => void refetch()}
        />
      ) : !shown?.length ? (
        <EmptyState
          title="No plans available"
          description="Plans are being updated. Check back in a few minutes."
        />
      ) : (
        <div className={cn("grid grid-cols-1 gap-3", gridCols(shown.length))}>
          {shown.map((plan) => {
            const allowance = planAllowanceLabel(plan);
            const isCurrent = isPaid && plan.key === currentKey;
            const per = intervalLabel(plan.interval);
            const { lead, items } = planCardFeatures(plan);
            // Offer the trial only when checkout really starts one;
            // returning subscribers pay from day one.
            const label = !isPaid
              ? trialDays
                ? `Start ${trialDays}-day free trial`
                : `Choose ${plan.name}`
              : plan.priceUsd > currentPrice
                ? `Upgrade to ${plan.name}`
                : `Switch to ${plan.name}`;

            return (
              <Card
                key={plan.key}
                size="sm"
                className={cn(isCurrent && "ring-foreground/30")}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    {plan.name}
                    {isCurrent ? (
                      <Badge variant="secondary">Current plan</Badge>
                    ) : null}
                  </CardTitle>
                  {plan.description ? (
                    <CardDescription>{plan.description}</CardDescription>
                  ) : null}
                </CardHeader>

                <CardContent className="flex-1 gap-0">
                  <p className="text-3xl font-medium tabular-nums">
                    {formatUsd(plan.priceUsd)}
                    {per ? (
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        / {per}
                      </span>
                    ) : null}
                  </p>
                  {allowance ? (
                    <p className="mt-1 text-sm text-muted-foreground">{allowance}</p>
                  ) : null}
                  {lead || items.length ? (
                    <>
                      <Separator className="my-4" />
                      <ul className="space-y-2">
                        {lead ? (
                          <li className="flex gap-2 font-medium">
                            <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <span>{lead}</span>
                          </li>
                        ) : null}
                        {items.map((feature) => (
                          <li key={feature} className="flex gap-2">
                            <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </CardContent>

                {isCurrent ? null : (
                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={plan.isPopular ? "default" : "outline"}
                      disabled={pendingKey !== null}
                      onClick={() => void handleSelect(plan.key)}
                    >
                      {pendingKey === plan.key ? (
                        <Spinner data-icon="inline-start" />
                      ) : null}
                      {label}
                    </Button>
                  </CardFooter>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
