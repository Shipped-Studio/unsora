"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle } from "@phosphor-icons/react";
import { ConnectAgentTabs } from "@/components/agents/connect-agent-tabs";
import { OpenAIIcon } from "@/components/icons";
import { ConnectGrid } from "@/components/scheduler/accounts-view";
import { AccountAvatar, accountLabel } from "@/components/scheduler/account-avatar";
import { formatLongDate, formatUsd, intervalLabel, planCreditsLabel } from "@/components/billing/format";
import { redirectToStripe } from "@/components/billing/redirect-to-stripe";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/shared/states";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import {
  useSubscriptionPlans,
  useTrialDays,
  type SubscriptionPlan,
} from "@/hooks/use-subscription-plans";
import { cn } from "@/lib/utils";
import { HowItWorksLoop, useLoopClock, type Beat } from "./how-it-works-loop";
import type { SetupContext } from "./setup";

/*
 * The steps of both setups (see setup.ts). `ctx.appName` is the app being
 * connected, or null in the app's own onboarding, which only changes wording.
 *
 * Every step shares one shape: a title, one short line under it, the content,
 * and a footer with Back on the left and one primary action on the right.
 * Cards are flat (a hairline ring, no shadow); lime is kept for progress and
 * success, so it always means "done" or "you are here".
 */

export const CARD = "rounded-2xl bg-card ring-1 ring-border";

export function StepHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string;
  title: string;
  lead: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-xl space-y-3 text-center">
      {eyebrow ? (
        <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
          {eyebrow}
        </p>
      ) : null}
      {/* Focus lands here when the step changes, so screen readers announce it. */}
      <h1
        tabIndex={-1}
        className="font-display text-3xl leading-[1.1] font-bold tracking-[-0.035em] text-balance text-foreground outline-none sm:text-4xl"
      >
        {title}
      </h1>
      <p className="text-base text-muted-foreground">{lead}</p>
    </div>
  );
}

/**
 * On phones the footer sticks to the bottom of the screen, with Back as an
 * arrow and the main action taking the width, so the next step is always one
 * tap away however long the step is. From sm up it sits under the content.
 */
export function StepFooter({
  back,
  divider,
  children,
}: {
  back: (() => void) | null;
  /** A hairline above the footer from sm up. */
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-4 mt-10 flex items-center gap-2 border-t bg-background/85 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:mx-0 sm:justify-between sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none",
        divider && "sm:border-t sm:pt-6",
      )}
    >
      {back ? (
        <Button variant="ghost" size="lg" onClick={back} className="text-muted-foreground max-sm:px-3">
          <ArrowLeft />
          <span className="max-sm:sr-only">Back</span>
        </Button>
      ) : (
        <span className="max-sm:hidden" />
      )}
      <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none max-sm:[&>*:last-child]:flex-1">
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

export function ChannelsStep({ ctx }: { ctx: SetupContext }) {
  const { data: accounts } = useConnectedAccounts();
  const connected = accounts ?? [];

  return (
    <section className="mx-auto w-full max-w-4xl">
      <StepHeader
        eyebrow="Connect channels"
        title={`Where should ${ctx.appName ?? "Unsora"} post?`}
        lead={`Connect the accounts ${ctx.appName ? `${ctx.appName} can publish` : "you want to publish"} to. It's free, and you can add more later from Accounts.`}
      />

      <div className={cn(CARD, "mt-10 p-4 sm:p-6")}>
        {connected.length ? (
          <ul className="mb-5 flex flex-wrap items-center gap-2 border-b pb-5" aria-label="Connected">
            {connected.map((account) => (
              <li
                key={account.id}
                className="flex min-w-0 animate-in items-center gap-2 rounded-full bg-success-subtle py-1 pr-3 pl-1 text-sm duration-300 zoom-in-95 fade-in"
              >
                <AccountAvatar account={account} size="sm" />
                <span className="max-w-40 truncate">{accountLabel(account)}</span>
                <Check className="size-3.5 shrink-0 text-success" weight="bold" />
                <span className="sr-only">connected</span>
              </li>
            ))}
          </ul>
        ) : null}
        {/* Google Business isn't a place for shorts; it stays on Accounts. */}
        <ConnectGrid returnTo={ctx.hrefFor("channels")} hidePlanNote exclude={["google_business"]} />
      </div>

      <StepFooter back={ctx.back} divider>
        {connected.length ? (
          <Button size="lg" onClick={ctx.next}>
            Continue
            <ArrowRight data-icon="inline-end" />
          </Button>
        ) : (
          <Button size="lg" variant="outline" onClick={ctx.next}>
            Skip for now
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
      </StepFooter>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

export function HowToStep({ ctx }: { ctx: SetupContext }) {
  const { t, beat } = useLoopClock();
  const points: { beat: Beat; title: string; line: string }[] = [
    { beat: "ask", title: "Mention Unsora", line: "Paste a video link, ask for shorts." },
    { beat: "make", title: "Unsora clips it", line: "Best moments, captioned, vertical." },
    { beat: "post", title: "It gets scheduled", line: "TikTok, Instagram, YouTube and more." },
  ];

  return (
    <section className="mx-auto w-full max-w-4xl">
      <StepHeader
        title="How it works"
        lead={`Clip videos and schedule posts, right in ${ctx.appName ?? "ChatGPT or Claude"}.`}
      />

      <div className="mt-8 grid items-center gap-5 sm:mt-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-12">
        {/* In the app's own onboarding, the film shows ChatGPT as the example. */}
        <HowItWorksLoop
          appName={ctx.appName ?? "ChatGPT"}
          appLogoUrl={ctx.appLogoUrl}
          appIcon={ctx.appName ? undefined : OpenAIIcon}
          t={t}
        />

        {/* Phones: one live caption under the film instead of the full list. */}
        <div className="flex items-center gap-4 lg:hidden" aria-hidden>
          <span className="flex gap-1.5">
            {points.map((point) => (
              <span
                key={point.beat}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  point.beat === beat ? "w-5 bg-foreground" : "w-1.5 bg-input",
                )}
              />
            ))}
          </span>
          {points
            .filter((point) => point.beat === beat)
            .map((point) => (
              <p key={point.beat} className="animate-in duration-300 fade-in">
                <span className="font-medium">{point.title}.</span>{" "}
                <span className="text-muted-foreground">{point.line}</span>
              </p>
            ))}
        </div>

        {/* Screen readers always get the list; sighted phone users get the caption. */}
        <ol className="sr-only space-y-2 lg:not-sr-only">
          {points.map((point, i) => {
            const active = point.beat === beat;
            return (
              <li
                key={point.beat}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex items-center gap-4 rounded-2xl p-4 transition-colors duration-300",
                  active ? "bg-card ring-1 ring-border" : "",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold transition-colors duration-300",
                    active ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <div>
                  <p className={cn("font-medium transition-colors", !active && "text-muted-foreground")}>
                    {point.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{point.line}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <StepFooter back={ctx.back}>
        <Button size="lg" onClick={ctx.next}>
          Continue
          <ArrowRight data-icon="inline-end" />
        </Button>
      </StepFooter>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * What every plan gets, from Unsora's listing in ChatGPT. Shown under each
 * plan's own features (set at /admin/pricing) so the cards say what you
 * actually do with Unsora, not only how much of it you get.
 */
const INCLUDED = [
  "Clip videos into up to 20 shorts",
  "Captions in 35 animated styles",
  "Post to TikTok, Instagram, YouTube",
  "AI video, music and voiceovers",
  "Thumbnails and 4K upscaling",
  "Works in ChatGPT and Claude",
];

/** Features shown on a phone before "show all". */
const PHONE_FEATURES = 4;

export function TrialStep({ ctx }: { ctx: SetupContext }) {
  const { authFetch } = useAuthFetch();
  const { plans, loading, error, refetch } = useSubscriptionPlans();
  const trialDays = useTrialDays(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  // Captured once so the charge date doesn't drift between renders.
  const [openedAt] = useState(() => Date.now());

  const hasTrial = (trialDays ?? 0) > 0;
  const chargeDate = hasTrial
    ? formatLongDate(new Date(openedAt + (trialDays ?? 0) * 86_400_000).toISOString())
    : null;

  const start = async (planKey: string) => {
    setPendingKey(planKey);
    const redirecting = await redirectToStripe(
      authFetch("/api/stripe/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({
          key: planKey,
          // Stripe brings them back to this step (OAuth params and all), with
          // `checkout=success|cancel` added; the setup moves on from there.
          returnPath: ctx.hrefFor("trial"),
        }),
      }),
      "Couldn't start checkout",
    );
    if (!redirecting) setPendingKey(null);
  };

  return (
    <section className="mx-auto w-full max-w-6xl">
      <StepHeader
        title={hasTrial ? `Try Unsora free for ${trialDays} days` : "Pick a plan"}
        lead={hasTrial ? "Every plan starts free. Cancel anytime." : "Clipping and creating use credits."}
      />

      <div className="mt-10">
        {loading || trialDays === null ? (
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-120 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <ErrorState title="Couldn't load plans" description={error} onRetry={() => void refetch()} />
        ) : (
          <ul
            className={cn(
              "grid items-stretch gap-3",
              (plans?.length ?? 0) >= 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3",
            )}
          >
            {plans?.map((plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                trialDays={hasTrial ? (trialDays ?? 0) : 0}
                pending={pendingKey === plan.key}
                disabled={pendingKey !== null}
                onStart={() => void start(plan.key)}
              />
            ))}
          </ul>
        )}
      </div>

      {hasTrial ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Nothing is charged until {chargeDate}.
        </p>
      ) : null}

      <StepFooter back={ctx.back}>
        <Button size="lg" variant="ghost" onClick={ctx.next} disabled={pendingKey !== null}>
          Not now
        </Button>
      </StepFooter>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

/** The app's own onboarding only: an agent connection already is one. */
export function AgentsStep({ ctx, finishing }: { ctx: SetupContext; finishing?: boolean }) {
  return (
    <section className="mx-auto w-full max-w-4xl">
      <StepHeader
        eyebrow="Connect an AI agent"
        title="Use Unsora from your AI"
        lead="Ask ChatGPT, Claude or Cursor in plain words, and it clips, creates and schedules for you. You can also do this later from Agents."
      />

      <div className={cn(CARD, "mt-10 p-4 sm:p-6")}>
        <ConnectAgentTabs />
      </div>

      <StepFooter back={ctx.back} divider>
        <Button size="lg" onClick={ctx.next} disabled={finishing}>
          {ctx.last ? (
            <>
              {finishing ? <Spinner data-icon="inline-start" /> : <CheckCircle data-icon="inline-start" />}
              Get started
            </>
          ) : (
            <>
              Continue
              <ArrowRight data-icon="inline-end" />
            </>
          )}
        </Button>
      </StepFooter>
    </section>
  );
}

function PlanCard({
  plan,
  trialDays,
  pending,
  disabled,
  onStart,
}: {
  plan: SubscriptionPlan;
  /** 0 when checkout won't start a trial. */
  trialDays: number;
  pending: boolean;
  disabled: boolean;
  onStart: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const per = intervalLabel(plan.interval);
  // Clipping is what Unsora is known for, so it goes third: right after the
  // plan's account limit and scheduling, ahead of the rest.
  const own = plan.features ?? [];
  const [clipping, ...rest] = INCLUDED;
  const features = [...new Set([...own.slice(0, 2), clipping, ...own.slice(2), ...rest])];
  const hidden = features.length - PHONE_FEATURES;

  return (
    <li
      className={cn(
        "flex flex-col rounded-2xl bg-card p-5 ring-1 sm:p-6",
        plan.isPopular ? "ring-2 ring-foreground" : "ring-border",
      )}
    >
      <p className="flex items-center gap-2 font-medium">
        {plan.name}
        {plan.isPopular ? (
          <span className="rounded-full bg-foreground px-2 py-0.5 text-2xs font-medium text-background">
            Popular
          </span>
        ) : null}
      </p>
      <p className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">
        {formatUsd(plan.priceUsd)}
        {per ? <span className="text-sm font-normal text-muted-foreground"> / {per}</span> : null}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {planCreditsLabel(plan.credits, plan.interval)}
      </p>

      <Button
        size="lg"
        variant={plan.isPopular ? "default" : "outline"}
        className="mt-6 w-full"
        disabled={disabled}
        onClick={onStart}
      >
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {trialDays ? "Start free trial" : `Choose ${plan.name}`}
      </Button>
      {trialDays ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {/* Non-breaking hyphen keeps "7-day" on one line. */}
          {trialDays}&#8209;day free trial, then {formatUsd(plan.priceUsd)}
          {per ? `/${per}` : ""}
        </p>
      ) : null}

      <ul className="mt-6 space-y-2.5 border-t pt-6 text-sm">
        {features.map((feature, i) => (
          <li
            key={feature}
            // Phones show the first few until "show all", so three plans stay scannable.
            className={cn("flex gap-2.5", !showAll && i >= PHONE_FEATURES && "max-sm:hidden")}
          >
            <Check className="mt-0.5 size-4 shrink-0 text-success" weight="bold" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {hidden > 0 && !showAll ? (
        <Button
          variant="link"
          size="sm"
          className="mt-2 self-start px-0 text-muted-foreground sm:hidden"
          onClick={() => setShowAll(true)}
        >
          Show {hidden} more
        </Button>
      ) : null}
    </li>
  );
}
