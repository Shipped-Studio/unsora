"use client";

import { useSearchParams } from "next/navigation";
import { ArrowRight, CalendarCheck, Check, Scissors } from "@phosphor-icons/react";
import { CreditPlanGrid, useCreditPlanChoice } from "@/components/billing/credit-plan-grid";
import { formatUsd } from "@/components/billing/format";
import { Button } from "@/components/ui/button";
import { PlanTabs } from "@/components/billing/plan-tabs";
import { Spinner } from "@/components/ui/spinner";
import { useCreditPlans } from "@/hooks/use-credit-plans";
import { useUserUsage } from "@/hooks/use-user-usage";
import { cn } from "@/lib/utils";
import {
  CREDITS_PLAN_PARAM,
  MONTHLY_VIEW,
  VIEW_PARAM,
  hasPaidPlan,
  type SetupContext,
} from "./setup";
import { CARD, StepFooter, StepHeader } from "./setup-steps";

/*
 * Monthly credits in onboarding, in two places:
 *
 *   - the plan step's second tab, for someone who doesn't post: one of the
 *     tiers is the way on (the other tab is the scheduler trial).
 *   - the credits step, after the free trial: the scheduler is unlocked but
 *     includes no credits, so first the question, then on a yes the tiers.
 *     Both can be skipped.
 *
 * Only Monthly credits here; one-time packs are sold in the app.
 */

/** What the scheduler came with: someone who's had a plan before gets no new trial. */
function usePlanWord() {
  const { usage } = useUserUsage();
  return usage?.user.status === "active" ? "plan" : "free trial";
}

const monthlyHref = (ctx: SetupContext, step: "plan" | "credits" = "credits") =>
  ctx.hrefFor(step, { [VIEW_PARAM]: MONTHLY_VIEW });

/**
 * The plan step: the scheduler with its free trial, or Monthly credits on
 * their own. The tab is in the URL (`view=monthly`), so Stripe's return
 * lands on the one that was bought.
 */
export function PlanStep({
  ctx,
  finishing,
  scheduler,
}: {
  ctx: SetupContext;
  finishing?: boolean;
  /** The scheduler tab's content (setup-steps' TrialStep). */
  scheduler: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const monthly = searchParams.get(VIEW_PARAM) === MONTHLY_VIEW;
  const bought = searchParams.get(CREDITS_PLAN_PARAM) === "success";

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* After buying, the success screen stands alone. */}
      {bought ? null : (
        <PlanTabs
          value={monthly ? "monthly" : "scheduler"}
          onValueChange={(value) =>
            window.history.pushState(
              null,
              "",
              value === "monthly" ? monthlyHref(ctx, "plan") : ctx.hrefFor("plan"),
            )
          }
          items={[
            { value: "scheduler", label: "Scheduler · free trial" },
            { value: "monthly", label: "Monthly credits" },
          ]}
          className="mb-8 items-center"
        />
      )}
      {monthly ? <CreditPlansStep ctx={ctx} finishing={finishing} step="plan" /> : scheduler}
    </div>
  );
}

export function CreditsAskStep({ ctx, finishing }: { ctx: SetupContext; finishing?: boolean }) {
  const { plans } = useCreditPlans();
  const planWord = usePlanWord();
  const lowest = plans?.length ? Math.min(...plans.map((plan) => plan.priceUsd)) : null;
  const showPlans = () => window.history.pushState(null, "", monthlyHref(ctx));

  return (
    <section className="mx-auto flex w-full flex-1 flex-col max-w-xl">
      <StepHeader
        eyebrow="Scheduler unlocked"
        title="Do you also need clipping and AI credits?"
        lead={`Scheduling is included in your ${planWord}. Clipping and AI creation use credits.`}
      />

      <ul className={cn(CARD, "mt-10 divide-y")}>
        <li className="flex items-center gap-4 p-4 sm:p-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
            <CalendarCheck className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Scheduling and posting</p>
            <p className="text-sm text-muted-foreground">Unlocked with your {planWord}.</p>
          </div>
          <Check className="size-4 shrink-0 text-success" weight="bold" />
        </li>
        <li className="flex items-center gap-4 p-4 sm:p-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Scissors className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Clipping and AI creation</p>
            <p className="text-sm text-muted-foreground">
              Monthly credits{lowest !== null ? `, from ${formatUsd(lowest)}/month` : ""}.
            </p>
          </div>
        </li>
      </ul>

      <StepFooter back={null}>
        <Button size="lg" variant="outline" className="max-sm:flex-1" onClick={ctx.next} disabled={finishing}>
          {finishing ? <Spinner data-icon="inline-start" /> : null}
          Skip for now
        </Button>
        <Button size="lg" onClick={showPlans} disabled={finishing}>
          Yes, add credits
          <ArrowRight data-icon="inline-end" />
        </Button>
      </StepFooter>
    </section>
  );
}

export function CreditPlansStep({
  ctx,
  finishing,
  step = "credits",
}: {
  ctx: SetupContext;
  finishing?: boolean;
  /** `plan`: the plan step's tab; `credits`: the add-on after a trial. */
  step?: "plan" | "credits";
}) {
  const searchParams = useSearchParams();
  const { usage } = useUserUsage();
  // Stripe comes back here, with `creditsPlan=success|cancel` added.
  const choice = useCreditPlanChoice(monthlyHref(ctx, step));
  const withScheduler = hasPaidPlan(usage);
  const addOn = step === "credits";

  if (searchParams.get(CREDITS_PLAN_PARAM) === "success") {
    return (
      <section className="mx-auto flex w-full flex-1 flex-col max-w-xl">
        <StepHeader
          title="Monthly credits are on"
          lead={
            withScheduler
              ? "You're ready to clip, create and post. New credits arrive every month."
              : "You're ready to clip and create. New credits arrive every month, and you can add the scheduler any time from Billing."
          }
        />
        <div className="mt-10 flex justify-center">
          <span className="flex size-16 animate-in items-center justify-center rounded-full bg-brand text-brand-foreground duration-300 zoom-in-75 fade-in">
            <Check className="size-8" weight="bold" />
          </span>
        </div>
        <StepFooter back={null}>
          <Button size="lg" onClick={ctx.next} disabled={finishing}>
            {finishing ? <Spinner data-icon="inline-start" /> : null}
            Proceed
            {finishing ? null : <ArrowRight data-icon="inline-end" />}
          </Button>
        </StepFooter>
      </section>
    );
  }

  const busy = choice.pendingKey !== null;
  // The add-on goes back to its question; the plan tab to the step before.
  const back = addOn ? () => window.history.pushState(null, "", ctx.hrefFor("credits")) : ctx.back;

  return (
    <section className="mx-auto flex w-full flex-1 flex-col max-w-6xl">
      <StepHeader
        title={withScheduler ? "Add monthly credits" : "Get monthly credits"}
        lead={
          withScheduler
            ? "Credits every month for clipping and AI, separate from your scheduler plan."
            : "Credits every month for clipping and AI. No scheduler needed."
        }
      />

      <div className="mt-10">
        <CreditPlanGrid choice={choice} />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Charged today, then monthly. Unused credits don&apos;t roll over. Cancel anytime from Billing.
        </p>
      </div>

      <StepFooter back={busy ? null : back}>
        {/* On the plan step a tier (or the trial) is the way on: nothing to skip to. */}
        {addOn ? (
          <Button size="lg" variant="outline" onClick={ctx.next} disabled={busy || finishing}>
            {finishing ? <Spinner data-icon="inline-start" /> : null}
            Skip for now
          </Button>
        ) : null}
      </StepFooter>
    </section>
  );
}
