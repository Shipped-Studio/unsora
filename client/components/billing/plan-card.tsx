"use client";

import { Check, CreditCard, Lightning } from "@phosphor-icons/react";
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
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface PlanCardProps {
  planKey: string;
  name: string;
  description: string;
  price: number;
  credits: number;
  features: readonly string[] | string[];
  isPopular: boolean;
  isBestValue?: boolean;
  isCurrent: boolean;
  /** Whether the user already has any paid plan (gates upgrade/downgrade UX). */
  isPaid: boolean;
  /** Current plan price — used to label upgrade vs downgrade. */
  currentPrice: number;
  /** True when checkout is in flight for THIS plan. */
  isLoading: boolean;
  /** True when checkout is in flight for ANY plan — disables others. */
  anyLoading: boolean;
  onSelect: (planKey: string) => void;
}

/**
 * Single subscription tier card. Three CTA states:
 *   - Current plan          → disabled "Current Plan" button
 *   - Already paid (other)  → "Upgrade"/"Downgrade" → confirm dialog, then
 *                             Stripe Checkout for the new plan (remaining
 *                             credits carry over, old subscription cancelled)
 *   - Free user             → "Get {plan}" → opens Stripe Checkout
 *
 * Built on the project `Card` primitive. The "Most Popular" badge sits
 * outside the card edge so we override Card's `overflow-hidden` only on
 * the popular tier.
 */
export function PlanCard({
  planKey,
  name,
  description,
  price,
  credits,
  features,
  isPopular,
  isBestValue = false,
  isCurrent,
  isPaid,
  currentPrice,
  isLoading,
  anyLoading,
  onSelect,
}: PlanCardProps) {
  return (
    <Card
      className={cn(
        "relative",
        isPopular && "!overflow-visible ring-primary",
        isBestValue && "!overflow-visible",
        isCurrent && "bg-card",
      )}
    >
      {isPopular && (
        <Badge className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2">
          Most Popular
        </Badge>
      )}
      {isBestValue && (
        <Badge
          variant="outline"
          className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 border-primary bg-background text-primary"
        >
          Best Value
        </Badge>
      )}

      <CardHeader>
        <CardTitle className="text-sm font-semibold">{name}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">${price}</span>
          <span className="text-sm text-muted-foreground">/mo</span>
        </div>

        <div className="mt-3 text-xs font-medium text-muted-foreground">
          {credits.toLocaleString()} credits/month
        </div>

        <ul className="mt-4 flex flex-col gap-2">
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
      </CardContent>

      <CardFooter>
        {isCurrent ? (
          <Button variant="outline" className="w-full" size="sm" disabled>
            Current Plan
          </Button>
        ) : isPaid ? (
          <Button
            variant="outline"
            className="w-full"
            size="sm"
            disabled={anyLoading}
            onClick={() => onSelect(planKey)}
          >
            {isLoading ? (
              <Spinner />
            ) : (
              <>
                <CreditCard className="size-3.5" />
                {price > currentPrice ? "Upgrade" : "Downgrade"}
              </>
            )}
          </Button>
        ) : (
          <Button
            className="w-full"
            disabled={anyLoading}
            onClick={() => onSelect(planKey)}
          >
            {isLoading ? (
              <Spinner />
            ) : (
              <>
                <Lightning weight="fill" className="size-3.5" />
                Get {name}
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
