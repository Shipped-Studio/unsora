"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  DotsThreeOutline,
  RedditLogo,
} from "@phosphor-icons/react";
import {
  BingIcon,
  ClaudeIcon,
  FacebookIcon,
  GoogleIcon,
  GrokIcon,
  LinkedInIcon,
  OpenAIIcon,
  XIcon,
} from "@/components/icons";
import { ConnectGrid } from "@/components/scheduler/accounts-view";
import { AccountAvatar, accountLabel } from "@/components/scheduler/account-avatar";
import { formatLongDate, formatUsd, intervalLabel } from "@/components/billing/format";
import { CardGridSkeleton, PlanCard, cardGridClass, cardItemClass } from "@/components/billing/pricing-cards";
import { PostToRow } from "@/components/billing/post-to-row";
import { redirectToStripe } from "@/components/billing/redirect-to-stripe";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/shared/states";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { plansForSale, useSubscriptionPlans, useTrialDays } from "@/hooks/use-subscription-plans";
import { cn } from "@/lib/utils";
import type { ConnectorApp } from "./connector-app";
import { HowItWorksLoop, useLoopClock, type Beat } from "./how-it-works-loop";
import type { SetupContext } from "./setup";

/*
 * The onboarding's steps (see setup.ts).
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
  children,
}: {
  back: (() => void) | null;
  children: React.ReactNode;
}) {
  return (
    <>
      {/* On a phone the gap grows, so the bar sits at the bottom of the
          screen on a short step instead of right under its content. */}
      <div aria-hidden className="h-10 shrink-0 max-sm:flex-1" />
      <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-2 border-t bg-background/85 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:mx-0 sm:justify-between sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
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
    </>
  );
}

/* ------------------------------------------------------------------------ */

/** Answers for "How did you hear about Unsora?", each with its logo. */
const SOURCES: { name: string; icon: React.ReactNode }[] = [
  { name: "ChatGPT", icon: <OpenAIIcon className="size-5" /> },
  { name: "Claude", icon: <ClaudeIcon className="size-5" /> },
  { name: "Grok", icon: <GrokIcon className="size-5" /> },
  { name: "Google", icon: <GoogleIcon className="size-5" /> },
  { name: "Bing", icon: <BingIcon className="size-5" /> },
  { name: "LinkedIn", icon: <LinkedInIcon className="size-5" /> },
  { name: "Reddit", icon: <RedditLogo className="size-5 text-[#FF4500]" weight="fill" /> },
  { name: "Facebook", icon: <FacebookIcon className="size-5" /> },
  { name: "X", icon: <XIcon className="size-5" /> },
  { name: "Other", icon: <DotsThreeOutline className="size-5 text-muted-foreground" weight="fill" /> },
];

/**
 * First question after sign-up: where they heard about Unsora.
 * Saved on the Clerk user (`unsafeMetadata.heardFrom`) and as a PostHog
 * person property. Optional; the flow leaves it out once answered.
 */
export function SourceStep({ ctx, finishing }: { ctx: SetupContext; finishing?: boolean }) {
  const { user } = useUser();
  const [choice, setChoice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = saving || Boolean(finishing);

  const save = async () => {
    if (!choice || !user) return ctx.next();
    setSaving(true);
    await user
      .update({ unsafeMetadata: { ...user.unsafeMetadata, heardFrom: choice } })
      .catch(() => {});
    if (posthog.__loaded) posthog.setPersonProperties({ heard_from: choice });
    ctx.next();
  };

  return (
    <section className="mx-auto flex w-full flex-1 flex-col max-w-3xl">
      <StepHeader
        eyebrow="One quick question"
        title="How did you hear about Unsora?"
        lead="It helps us know where to show up."
      />

      <div className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Where you heard about Unsora">
        {SOURCES.map((source) => (
          <button
            key={source.name}
            type="button"
            role="radio"
            aria-checked={choice === source.name}
            onClick={() => setChoice(source.name)}
            className={cn(
              "flex items-center gap-3 rounded-xl bg-card px-4 py-3 text-left text-sm font-medium ring-1 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              choice === source.name ? "ring-2 ring-foreground" : "ring-border hover:bg-accent",
            )}
          >
            <span className="flex size-5 shrink-0 items-center justify-center">{source.icon}</span>
            {source.name}
          </button>
        ))}
      </div>

      <StepFooter back={ctx.back}>
        <Button size="lg" variant="ghost" onClick={ctx.next} disabled={busy}>
          Skip
        </Button>
        <Button size="lg" onClick={() => void save()} disabled={!choice || busy}>
          {busy ? <Spinner data-icon="inline-start" /> : null}
          {ctx.last ? "Finish" : "Continue"}
          {ctx.last ? null : <ArrowRight data-icon="inline-end" />}
        </Button>
      </StepFooter>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

export function ChannelsStep({ ctx }: { ctx: SetupContext }) {
  const { data: accounts } = useConnectedAccounts();
  const connected = accounts ?? [];

  return (
    <section className="mx-auto flex w-full flex-1 flex-col max-w-4xl">
      <StepHeader
        eyebrow="Connect channels"
        title="Where should Unsora post?"
        lead="Connect the accounts you want to publish to. It's free, and you can add more later from Accounts."
      />

      <div className="mt-10 rounded-2xl bg-card p-4 sm:p-6">
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

      <StepFooter back={ctx.back}>
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

export function HowToStep({ ctx, app }: { ctx: SetupContext; app: ConnectorApp | null }) {
  const { t, beat } = useLoopClock();
  const points: { beat: Beat; title: string; line: string }[] = [
    { beat: "schedule", title: "Schedule posts", line: "Ask to post a video, now or later." },
    { beat: "clip", title: "Clip long videos", line: "Paste a link, get captioned shorts." },
    { beat: "post", title: "Post everywhere", line: "TikTok, Instagram, YouTube and more." },
  ];

  return (
    <section className="mx-auto flex w-full flex-1 flex-col max-w-4xl">
      <StepHeader
        title="How it works"
        lead={`Schedule posts and clip videos, right in ${app ? app.name : "ChatGPT or Claude"}.`}
      />

      <div className="mt-8 grid items-center gap-5 sm:mt-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-12">
        {/* The app being connected, else ChatGPT as the example. */}
        <HowItWorksLoop
          appName={app?.name ?? "ChatGPT"}
          appIcon={app?.icon ?? OpenAIIcon}
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

export function TrialStep({ ctx }: { ctx: SetupContext }) {
  const { authFetch } = useAuthFetch();
  const { plans: allPlans, loading, error, refetch } = useSubscriptionPlans();
  const plans = plansForSale(allPlans);
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
          // Stripe brings them back to this step (the app being connected
          // too), with `checkout=success|cancel` added; the setup moves on
          // from there.
          returnPath: ctx.hrefFor("plan"),
        }),
      }),
      "Couldn't start checkout",
    );
    if (!redirecting) setPendingKey(null);
  };

  return (
    <section className="mx-auto flex w-full flex-1 flex-col max-w-6xl">
      <StepHeader
        title={hasTrial ? `Try Unsora free for ${trialDays} days` : "Pick a plan"}
        lead={hasTrial ? "Every plan starts free. Cancel anytime." : "Plans are priced by how many accounts you post to."}
      />

      <PostToRow className="mt-8 justify-center" />

      <div className="mt-10">
        {loading || trialDays === null ? (
          <CardGridSkeleton />
        ) : error ? (
          <ErrorState title="Couldn't load plans" description={error} onRetry={() => void refetch()} />
        ) : (
          <ul className={cardGridClass(plans?.length ?? 0)}>
            {plans?.map((plan) => {
              const per = intervalLabel(plan.interval);
              return (
                <li key={plan.key} className={cardItemClass(plans?.length ?? 0)}>
                  <PlanCard
                    plan={plan}
                    highlight={Boolean(plan.isPopular)}
                    badge={plan.isPopular ? "Popular" : undefined}
                    trialDays={hasTrial ? (trialDays ?? 0) : 0}
                    action={{
                      label: hasTrial ? "Start free trial" : `Choose ${plan.name}`,
                      onClick: () => void start(plan.key),
                      pending: pendingKey === plan.key,
                      disabled: pendingKey !== null,
                    }}
                    note={
                      hasTrial
                        ? `Then ${formatUsd(plan.priceUsd)}${per ? `/${per}` : ""}. Cancel anytime.`
                        : null
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {hasTrial ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Nothing is charged until {chargeDate}.
        </p>
      ) : null}

      {/* No way past this step without a plan: a scheduler plan or Monthly
          credits (the other tab) is the only way on. */}
      <StepFooter back={ctx.back}>{null}</StepFooter>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * Last step for an account made while connecting an AI app. The app's OAuth
 * request wasn't carried through sign-up, so they connect again from the app,
 * now with channels and a plan to use.
 */
export function ConnectStep({
  ctx,
  app,
  finishing,
}: {
  ctx: SetupContext;
  app: ConnectorApp;
  finishing?: boolean;
}) {
  const name = app.name;
  const where = app.url ? name : "the app";
  const steps = [
    { title: `Go back to ${where}`, line: "Where you started connecting Unsora." },
    { title: "Connect Unsora again", line: "Start it again from the apps or connectors settings." },
    { title: "Allow Unsora", line: "You're signed in now, so it's one click." },
  ];

  return (
    <section className="mx-auto flex w-full flex-1 flex-col max-w-xl">
      <StepHeader
        eyebrow="You're set up"
        title={`Now connect ${name}`}
        lead={`Your Unsora account is ready. Connect it from ${where} to clip and post right in the chat.`}
      />

      <ol className={cn(CARD, "mt-10 divide-y")}>
        {steps.map((step, i) => (
          <li key={step.title} className="flex items-center gap-4 p-4 sm:p-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-display text-sm font-bold text-muted-foreground">
              {i + 1}
            </span>
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="text-sm text-muted-foreground">{step.line}</p>
            </div>
          </li>
        ))}
      </ol>

      <StepFooter back={ctx.back}>
        <Button size="lg" onClick={ctx.next} disabled={finishing}>
          {finishing ? <Spinner data-icon="inline-start" /> : null}
          Go to Unsora
        </Button>
      </StepFooter>
    </section>
  );
}
