"use client";

import { Crown, Lightning } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";

interface CurrentPlanCardProps {
  name: string;
  description: string;
  price: number;
  isPaid: boolean | undefined;
  /** Credits remaining in the user's wallet right now. */
  credits: number;
  /** Monthly credit allowance for the current plan. Used as the "of N" denominator. */
  monthlyCredits: number;
}

/**
 * Header card on the billing page showing the user's current plan tier,
 * description, and price. Purely presentational.
 *
 * Uses the project `Card` primitive so the styling stays in sync with the
 * rest of the app (rounded-2xl, ring-1, bg-card). The price block lives in
 * `CardAction` so it auto-aligns to the top-right of the header grid.
 */
export function CurrentPlanCard({
  name,
  description,
  price,
  isPaid,
  credits,
  monthlyCredits,
}: CurrentPlanCardProps) {
  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Crown weight="fill" className="size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              {name} Plan
              {isPaid && (
                <Badge variant="secondary" className="text-[10px]">
                  Active
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>

        <CardAction className="text-right">
          <p className="text-2xl font-bold leading-none">${price}</p>
          <p className="mt-1 text-xs text-muted-foreground">/month</p>
        </CardAction>
      </CardHeader>

      <CardFooter className="flex gap-4 justify-end">
        <div className="flex items-center gap-2">
          <Lightning weight="fill" className="size-4 text-primary" />
          <span className="text-sm font-medium">Available credits</span>
        </div>
        <div className="text-sm">
          <span className="font-bold">{credits.toLocaleString()}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
