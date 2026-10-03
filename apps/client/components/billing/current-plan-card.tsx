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

export type PlanState = "free" | "active" | "trialing" | "ending";

interface CurrentPlanCardProps {
  planName: string;
  /** Catalog entry for the current plan, when it's a paid tier. */
  plan: SubscriptionPlan | null;
  state: PlanState;
  /** ISO end of the current paid (or trial) period. */
  periodEnd: string | null;
  credits: number;
  /** Which portal-bound button is waiting on the redirect. */
  portalPending: "manage" | "resume" | null;
  activating: boolean;
  onChangePlan: () => void;
  onManageBilling: () => void;
  onResume: () => void;
  onCancelPlan: () => void;
  onActivateTrial: () => void;
  onCancelTrial: () => void;
}

function statusLine(state: PlanState, endsOn: string | null) {
  switch (state) {
    case "free":
      return "Choose a plan to get credits and connect more social accounts.";
    case "active":
      return endsOn ? `Renews on ${endsOn}.` : "Your subscription is active.";
    case "trialing":
      return endsOn
        ? `Your trial ends on ${endsOn}. Activate now to start your plan, or cancel to return to Free.`
        : "Activate now to start your plan, or cancel to return to Free.";
    case "ending":
      return "Your plan won't renew. You keep access and your credits until then.";
  }
}

export function CurrentPlanCard({
  planName,
  plan,
  state,
  periodEnd,
  credits,
  portalPending,
  activating,
  onChangePlan,
  onManageBilling,
  onResume,
  onCancelPlan,
  onActivateTrial,
  onCancelTrial,
}: CurrentPlanCardProps) {
  const endsOn = formatLongDate(periodEnd);
  const per = intervalLabel(plan?.interval);
  const portalBusy = portalPending !== null;

  return (
    <Card>
      <CardHeader>
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

      <CardContent>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Credit balance</dt>
            <dd className="mt-1 text-2xl font-medium tabular-nums">
              {credits.toLocaleString()}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                credits
              </span>
            </dd>
          </div>
          {plan ? (
            <div>
              <dt className="text-xs text-muted-foreground">Plan includes</dt>
              <dd className="mt-1 text-2xl font-medium tabular-nums">
                {plan.credits.toLocaleString()}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  credits per {per ?? "billing period"}
                </span>
              </dd>
            </div>
          ) : null}
        </dl>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 border-t">
        {state === "free" ? (
          <Button onClick={onChangePlan}>Choose a plan</Button>
        ) : null}

        {state === "trialing" ? (
          <Button onClick={onActivateTrial} disabled={activating}>
            {activating ? <Spinner data-icon="inline-start" /> : null}
            Activate plan
          </Button>
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

        {state === "trialing" ? (
          <Button
            variant="link"
            size="sm"
            className="px-0 text-muted-foreground hover:text-foreground max-sm:basis-full max-sm:justify-start sm:ml-auto"
            onClick={onCancelTrial}
          >
            Cancel trial
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
