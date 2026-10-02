"use client";

import { useState } from "react";
import { Check, Lightning } from "@phosphor-icons/react";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PLAN_PRESENTATION } from "@/constant";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useUserUsage } from "@/hooks/use-user-usage";
import { useSubscriptionPlans } from "@/hooks/use-subscription-plans";

interface PricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PricingDialog({ open, onOpenChange }: PricingDialogProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { authFetch } = useAuthFetch();
  const { usage } = useUserUsage();
  const { plans, loading: plansLoading } = useSubscriptionPlans();

  const currentPlan = usage?.user?.plan?.toLowerCase() ?? "free";
  const isPaid = usage?.user?.isActive === true;

  const handleSelectPlan = async (planKey: string) => {
    setLoadingPlan(planKey);
    try {
      // Subscribed users go through the plan-switch flow (old subscription
      // cancelled on payment, remaining credits carried over); free users
      // through the regular first-purchase checkout.
      const endpoint = isPaid
        ? "/api/stripe/upgrade-plan"
        : "/api/stripe/create-checkout-session";
      const response = await authFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ key: planKey }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setLoadingPlan(null);
      }
    } catch {
      setLoadingPlan(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[90dvh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="text-xl font-semibold">
            Upgrade your plan
          </DialogTitle>
          <DialogDescription>
            {isPaid
              ? "Choose your new plan. Your current subscription will be cancelled, unused plan credits carry over, and top-up credits stay as they are."
              : "Choose the plan that works best for you."}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto overscroll-contain p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plansLoading && !plans
            ? Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-96 animate-pulse rounded-xl border border-border bg-muted/40"
                />
              ))
            : (plans ?? []).map((plan) => {
                const key = plan.key;
                const presentation = PLAN_PRESENTATION[key];
                const features = presentation?.features ?? [];
                const isPopular = plan.isPopular === true;
                const isBestValue = presentation?.isBestValue === true;
                const isCurrent = currentPlan === key;

                return (
                  <div
                    key={key}
                className={cn(
                  "relative flex flex-col rounded-xl border p-5 transition-all",
                  isPopular
                    ? "border-primary ring-1 ring-primary"
                    : "border-border",
                  isCurrent && "bg-muted/40",
                )}
              >
                {isPopular && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                {isBestValue && (
                  <Badge
                    variant="outline"
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 border-primary bg-background text-primary"
                  >
                    Best Value
                  </Badge>
                )}

                <div className="mb-4">
                  <h3 className="text-sm font-semibold">{plan.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {plan.description}
                  </p>
                </div>

                <div className="mb-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">${plan.priceUsd}</span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </div>

                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  {plan.credits.toLocaleString()} credits/month
                </div>

                <ul className="mb-5 mt-3 flex flex-col gap-2">
                  {features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-xs text-foreground/80"
                    >
                      <Check
                        weight="bold"
                        className="mt-0.5 size-3.5 shrink-0 text-primary"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  {isCurrent ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      size="sm"
                      disabled
                    >
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      disabled={loadingPlan !== null}
                      onClick={() => handleSelectPlan(key)}
                    >
                      {loadingPlan === key ? (
                        <Spinner />
                      ) : (
                        <>
                          <Lightning weight="fill" className="size-3.5" />
                          Get {plan.name}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
