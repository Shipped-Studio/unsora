"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { CreditSubscriptionState } from "@/hooks/use-user-usage";
import { formatLongDate, formatUsd, intervalLabel } from "./format";

export type CreditsState = "none" | "active" | "ending" | "past_due";

/** Where the Monthly credits card stands, from the usage response. */
export function creditsStateOf(sub: CreditSubscriptionState | null | undefined): CreditsState {
  if (!sub?.isActive) return "none";
  if (sub.status === "past_due") return "past_due";
  return sub.isCancelled ? "ending" : "active";
}

interface CurrentCreditsCardProps {
  subscription: CreditSubscriptionState | null;
  state: CreditsState;
  portalPending: boolean;
  onChoosePlan: () => void;
  onManageBilling: () => void;
  onCancel: () => void;
}

function statusLine(state: CreditsState, renewsOn: string | null) {
  switch (state) {
    case "none":
      return "Credits every month for clipping and AI, at a lower price per credit than packs.";
    case "active":
      return renewsOn
        ? `Renews on ${renewsOn}. Unused monthly credits don't roll over.`
        : "Unused monthly credits don't roll over.";
    case "ending":
      return renewsOn
        ? `Won't renew. Your monthly credits work until ${renewsOn}.`
        : "Won't renew. Your monthly credits work until the period ends.";
    case "past_due":
      return "Your last payment didn't go through. New monthly credits are added once it's paid.";
  }
}

export function CurrentCreditsCard({
  subscription,
  state,
  portalPending,
  onChoosePlan,
  onManageBilling,
  onCancel,
}: CurrentCreditsCardProps) {
  const renewsOn = formatLongDate(subscription?.currentPeriodEnd);
  const per = intervalLabel(subscription?.interval) ?? "month";
  const active = subscription && state !== "none";

  return (
    <Card className="h-full">
      <CardHeader>
        <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Monthly credits
        </p>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {active ? subscription.planName : "No monthly plan"}
          {state === "active" ? <Badge className="bg-success-subtle text-success">Active</Badge> : null}
          {state === "ending" ? (
            <Badge variant="outline">{renewsOn ? `Ends on ${renewsOn}` : "Ending"}</Badge>
          ) : null}
          {state === "past_due" ? (
            <Badge className="bg-destructive-subtle text-destructive">Payment failed</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>{statusLine(state, renewsOn)}</CardDescription>
        {active && subscription.priceUsd !== null ? (
          <CardAction className="text-right">
            <p className="text-lg font-medium tabular-nums">
              {formatUsd(subscription.priceUsd)}
              <span className="text-sm font-normal text-muted-foreground"> / {per}</span>
            </p>
          </CardAction>
        ) : null}
      </CardHeader>

      {active ? (
        <CardContent className="flex-1">
          <p className="text-2xl font-medium tabular-nums">
            {subscription.credits.toLocaleString()}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">credits every {per}</span>
          </p>
        </CardContent>
      ) : (
        <div className="flex-1" />
      )}

      <CardFooter className="flex flex-wrap gap-2 border-t">
        {state === "none" ? (
          <Button variant="outline" onClick={onChoosePlan}>
            See monthly plans
          </Button>
        ) : (
          <>
            {state === "past_due" ? (
              <Button onClick={onManageBilling} disabled={portalPending}>
                {portalPending ? <Spinner data-icon="inline-start" /> : null}
                Update card
              </Button>
            ) : (
              <Button variant="outline" onClick={onChoosePlan}>
                Change plan
              </Button>
            )}
            {state === "ending" ? (
              <Button onClick={onManageBilling} disabled={portalPending}>
                {portalPending ? <Spinner data-icon="inline-start" /> : null}
                Resume plan
              </Button>
            ) : null}
            {state === "active" ? (
              <Button
                variant="link"
                size="sm"
                className="px-0 text-muted-foreground hover:text-foreground max-sm:basis-full max-sm:justify-start sm:ml-auto"
                onClick={onCancel}
              >
                Cancel plan
              </Button>
            ) : null}
          </>
        )}
      </CardFooter>
    </Card>
  );
}
