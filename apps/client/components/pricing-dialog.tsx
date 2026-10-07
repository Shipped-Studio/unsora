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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState, ErrorState } from "@/components/shared/states";
import {
  formatUsd,
  intervalLabel,
  planCreditsLabel,
} from "@/components/billing/format";
import { redirectToStripe } from "@/components/billing/redirect-to-stripe";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useSubscriptionPlans } from "@/hooks/use-subscription-plans";
import { useUserUsage } from "@/hooks/use-user-usage";
import { cn } from "@/lib/utils";

interface PricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function gridCols(count: number) {
  return count >= 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3";
}

export function PricingDialog({ open, onOpenChange }: PricingDialogProps) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const { authFetch } = useAuthFetch();
  const { usage } = useUserUsage();
  const { plans, loading, error, refetch } = useSubscriptionPlans();

  const currentKey = (usage?.user.plan ?? "free").toLowerCase();
  const isPaid = usage?.user.isActive === true && currentKey !== "free";
  const currentPrice =
    plans?.find((p) => p.key === currentKey)?.priceUsd ?? 0;

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

  const count = plans?.length ?? 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0",
          count >= 4 ? "sm:max-w-6xl" : "sm:max-w-4xl",
        )}
      >
        <DialogHeader className="border-b p-6 pr-12">
          <DialogTitle>{isPaid ? "Change plan" : "Choose a plan"}</DialogTitle>
          <DialogDescription>
            {isPaid
              ? "Your current subscription ends once the new plan is paid. Unused plan credits carry over and top-up credits stay as they are."
              : "Plans renew automatically. You can cancel any time from Billing."}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto overscroll-contain p-6">
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
          ) : !plans?.length ? (
            <EmptyState
              title="No plans available"
              description="Plans are being updated. Check back in a few minutes."
            />
          ) : (
            <div className={cn("grid grid-cols-1 gap-3", gridCols(plans.length))}>
              {plans.map((plan) => {
                const isCurrent = isPaid && plan.key === currentKey;
                const per = intervalLabel(plan.interval);
                const features = plan.features ?? [];
                const label = !isPaid
                  ? `Choose ${plan.name}`
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
                      <p className="mt-1 text-sm text-muted-foreground">
                        {planCreditsLabel(plan.credits, plan.interval)}
                      </p>
                      {features.length ? (
                        <>
                          <Separator className="my-4" />
                          <ul className="space-y-2">
                            {features.map((feature) => (
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
