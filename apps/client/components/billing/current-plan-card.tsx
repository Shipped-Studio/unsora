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
import type { SubscriptionPlan } from "@/hooks/use-subscription-plans";
import { formatLongDate, formatUsd, intervalLabel } from "./format";
import { PostToRow } from "./post-to-row";

export type PlanState = "free" | "active" | "trialing" | "ending";

interface CurrentPlanCardProps {
  planName: string;
  /** Catalog entry for the current plan, when it's a paid tier. */
  plan: SubscriptionPlan | null;
  state: PlanState;
  /** ISO end of the current paid (or trial) period. */
  periodEnd: string | null;
  /** Which portal-bound button is waiting on the redirect. */
  portalPending: "manage" | "resume" | null;
  onChangePlan: () => void;
  onManageBilling: () => void;
  onResume: () => void;
  onCancelPlan: () => void;
}

function statusLine(state: PlanState, endsOn: string | null) {
  switch (state) {
    case "free":
      return "You can connect accounts for free, but posting needs a scheduler plan.";
    case "active":
      return endsOn ? `Renews on ${endsOn}.` : "Your subscription is active.";
    case "trialing":
      return endsOn
        ? `Your trial ends on ${endsOn}, then your plan starts. To cancel, use Manage billing.`
        : "Your plan starts when the trial ends. To cancel, use Manage billing.";
    case "ending":
      return endsOn
        ? `Your plan won't renew. You can keep posting until ${endsOn}.`
        : "Your plan won't renew. You can keep posting until the period ends.";
  }
}

export function CurrentPlanCard({
  planName,
  plan,
  state,
  periodEnd,
  portalPending,
  onChangePlan,
  onManageBilling,
  onResume,
  onCancelPlan,
}: CurrentPlanCardProps) {
  const endsOn = formatLongDate(periodEnd);
  const per = intervalLabel(plan?.interval);
  const portalBusy = portalPending !== null;

  return (
    <Card className="h-full">
      <CardHeader>
        <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Scheduler
        </p>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {planName}
          {state === "active" ? (
            <Badge className="bg-success-subtle text-success">Active</Badge>
          ) : null}
          {state === "trialing" ? <Badge variant="outline">Trial</Badge> : null}
          {state === "ending" ? (
            <Badge variant="outline">
              {endsOn ? `Ends on ${endsOn}` : "Ending"}
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>{statusLine(state, endsOn)}</CardDescription>
        {plan ? (
          <CardAction className="text-right">
            <p className="text-lg font-medium tabular-nums">
              {formatUsd(plan.priceUsd)}
              {per ? (
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / {per}
                </span>
              ) : null}
            </p>
          </CardAction>
        ) : null}
      </CardHeader>

      {plan?.socialAccounts ? (
        <CardContent className="flex-1">
          <dl>
            <dt className="text-xs text-muted-foreground">Posts to</dt>
            <dd className="mt-1 text-2xl font-medium tabular-nums">
              {plan.socialAccounts}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">social accounts</span>
            </dd>
          </dl>
        </CardContent>
      ) : state === "free" ? (
        <CardContent className="flex-1">
          <PostToRow />
        </CardContent>
      ) : (
        <div className="flex-1" />
      )}

      <CardFooter className="flex flex-wrap gap-2 border-t">
        {state === "free" ? (
          <Button onClick={onChangePlan}>Choose a scheduler plan</Button>
        ) : null}

        {state === "ending" ? (
          <Button onClick={onResume} disabled={portalBusy}>
            {portalPending === "resume" ? (
              <Spinner data-icon="inline-start" />
            ) : null}
            Resume plan
          </Button>
        ) : null}

        {state === "active" || state === "ending" ? (
          <Button variant="outline" onClick={onChangePlan}>
            Change plan
          </Button>
        ) : null}

        {state !== "free" ? (
          <Button
            variant="outline"
            onClick={onManageBilling}
            disabled={portalBusy}
          >
            {portalPending === "manage" ? (
              <Spinner data-icon="inline-start" />
            ) : null}
            Manage billing
          </Button>
        ) : null}

        {/* Leaving is a quiet text action, set apart from the main buttons. */}
        {state === "active" ? (
          <Button
            variant="link"
            size="sm"
            className="px-0 text-muted-foreground hover:text-foreground max-sm:basis-full max-sm:justify-start sm:ml-auto"
            onClick={onCancelPlan}
          >
            Cancel plan
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
