"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck,
  ChartLineUp,
  Check,
  CheckCircle,
  Scissors,
  Sparkle,
} from "@phosphor-icons/react";
import { ConnectAgentTabs, EXAMPLE_PROMPTS } from "@/components/agents/connect-agent-tabs";
import { CopyButton } from "@/components/api-keys/copy-button";
import { formatUsd, intervalLabel, planCreditsLabel } from "@/components/billing/format";
import { redirectToStripe } from "@/components/billing/redirect-to-stripe";
import { AccountAvatar, accountLabel } from "@/components/scheduler/account-avatar";
import { ConnectGrid } from "@/components/scheduler/accounts-view";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { useSubscriptionPlans } from "@/hooks/use-subscription-plans";
import { userUsageQueryKeys } from "@/hooks/use-user-usage";
import { cn } from "@/lib/utils";

/**
 * The onboarding steps, shared by the two places onboarding runs so both
 * show the same thing:
 *
 *   - in the app, at /onboarding after sign-up (app/(onboarding)/onboarding)
 *   - before the OAuth consent screen when an AI agent (ChatGPT, Claude, …)
 *     connects (app/oauth-consent/connector-flow.tsx)
 *
 *   channels → how it works → connect an AI agent, then the plans
 *
 * The last step differs only in where the agent is connected: the app shows
 * setup steps for each agent (AgentsStep), the connector flow its consent
 * screen. Steps take an `agentName` when running for an agent connection,
 * which only changes the wording. Reaching the last step sets the Clerk
 * `unsafeMetadata.onboardedAt` flag, and neither runs again after that.
 *
 * The plans (TrialStep) come after the agent is connected, for anyone
 * without a plan, and aren't a numbered step: the app shows them after its
 * last step, and the consent screen opens them in a new tab on Allow, since
 * Clerk sends that tab straight back to the agent.
 */

export type OnboardingStepId = "channels" | "learn";

export interface OnboardingStep {
  id: string;
  label: string;
}

export const ONBOARDING_STEPS: { id: OnboardingStepId; label: string }[] = [
  { id: "channels", label: "Channels" },
  { id: "learn", label: "How it works" },
];

/** Where the plans screen lives; the consent screen opens it after Allow. */
export const PLANS_URL = "/onboarding?step=plans";

type TitleRef = React.RefObject<HTMLHeadingElement | null>;

function StepHeading({
  titleRef,
  title,
  description,
}: {
  titleRef: TitleRef;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2 text-center">
      {/* Focus lands here when the step changes, so screen readers announce it. */}
      <h1
        ref={titleRef}
        tabIndex={-1}
        className="font-display text-2xl font-bold tracking-[-0.03em] text-foreground outline-none"
      >
        {title}
      </h1>
      <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function OnboardingStepper({
  steps,
  current,
}: {
  steps: OnboardingStep[];
  current: number;
}) {
  return (
    <ol
      aria-label="Setup progress"
      className="flex items-center justify-center gap-2 text-xs sm:gap-3 sm:text-sm"
    >
      {steps.map((s, i) => (
        <li key={s.id} className="flex items-center gap-2 sm:gap-3">
          <span
            aria-current={i === current ? "step" : undefined}
            className={cn(
              "flex items-center gap-1.5",
              i === current ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border text-[11px]",
                i < current && "border-success bg-success text-success-foreground",
                i === current && "border-foreground bg-foreground text-background",
              )}
            >
              {i < current ? <Check className="size-3" /> : i + 1}
            </span>
            <span className={cn(i !== current && "hidden sm:inline")}>
              {s.label}
              {i < current ? <span className="sr-only"> (done)</span> : null}
            </span>
          </span>
          {i < steps.length - 1 ? <span aria-hidden className="h-px w-4 bg-border sm:w-8" /> : null}
        </li>
      ))}
    </ol>
  );
}

export function ChannelsStep({
  titleRef,
  agentName,
  returnTo,
}: {
  titleRef: TitleRef;
  agentName?: string;
  /** Where to come back to after a channel's OAuth round trip. */
  returnTo: string;
}) {
  const { data: accounts } = useConnectedAccounts();
  return (
    <div className="space-y-6">
      <StepHeading
        titleRef={titleRef}
        title="Connect your social accounts"
        description={
          agentName
            ? `So ${agentName} can schedule and publish for you. You can add more any time in Unsora.`
            : "The accounts you want to post to. You can add more any time from Accounts."
        }
      />
      {accounts?.length ? (
        <ul className="flex flex-wrap justify-center gap-2">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex min-w-0 items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1 text-sm"
            >
              <AccountAvatar account={account} size="sm" />
              <span className="truncate">{accountLabel(account)}</span>
              <Check className="size-3.5 shrink-0 text-success" />
              <span className="sr-only">connected</span>
            </li>
          ))}
        </ul>
      ) : null}
      <ConnectGrid compact returnTo={returnTo} />
    </div>
  );
}

const CAN_DO = [
  { icon: Sparkle, title: "Make content", body: "Images, video, music and voiceovers from a prompt." },
  { icon: Scissors, title: "Clip long videos", body: "Turn a podcast or stream into short clips." },
  { icon: CalendarCheck, title: "Schedule and post", body: "To every connected account, now or later." },
  { icon: ChartLineUp, title: "Check results", body: "See how your posts did and what to post next." },
];

export function LearnStep({ titleRef, agentName }: { titleRef: TitleRef; agentName?: string }) {
  return (
    <div className="space-y-6">
      <StepHeading
        titleRef={titleRef}
        title={agentName ? `How to use Unsora in ${agentName}` : "How Unsora works"}
        description={
          agentName
            ? `Just ask in plain words. ${agentName} picks the right Unsora tool and shows you the result.`
            : "Do it all here, or ask ChatGPT, Claude or Cursor to do it for you."
        }
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CAN_DO.map((item) => (
          <div key={item.title} className="flex gap-3 rounded-xl bg-muted p-4">
            <item.icon className="mt-0.5 size-5 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {agentName ? "Try asking" : "Things to ask your AI agent"}
        </p>
        <ul className="space-y-1.5">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <li
              key={prompt}
              className="flex items-center gap-2 rounded-lg border bg-card py-1 pr-1 pl-3 text-sm"
            >
              <span className="min-w-0 flex-1 py-1">{prompt}</span>
              <CopyButton value={prompt} label="Copy prompt" size="icon-sm" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function TrialStep({
  titleRef,
  trialDays,
  started,
  returnPath,
}: {
  titleRef: TitleRef;
  trialDays: number | null;
  /** Back from a successful Stripe checkout. */
  started: boolean;
  /** Where Stripe returns to (the server adds `checkout=success|cancel`). */
  returnPath: string;
}) {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();
  const { plans, loading } = useSubscriptionPlans();
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Back from Stripe: the webhook may land a moment later, so read usage again.
  const refetched = useRef(false);
  useEffect(() => {
    if (!started || refetched.current) return;
    refetched.current = true;
    void queryClient.invalidateQueries({ queryKey: userUsageQueryKeys.usage() });
  }, [started, queryClient]);

  if (started) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle weight="fill" className="mx-auto size-12 text-success" />
        <StepHeading
          titleRef={titleRef}
          title="You're all set"
          description="Your plan is active and your credits are on the way."
        />
      </div>
    );
  }

  const choice = selected ?? plans?.find((p) => p.isPopular)?.key ?? plans?.[0]?.key ?? null;
  const cta = trialDays ? `Start ${trialDays}-day free trial` : "Continue to checkout";

  const startCheckout = async () => {
    if (!choice) return;
    setPending(true);
    const redirecting = await redirectToStripe(
      authFetch("/api/stripe/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({ key: choice, returnPath }),
      }),
      "Couldn't start checkout",
    );
    if (!redirecting) setPending(false);
  };

  return (
    <div className="space-y-6">
      <StepHeading
        titleRef={titleRef}
        title={trialDays ? `Start your ${trialDays}-day free trial` : "Pick a plan"}
        description={
          trialDays
            ? "Posting needs a plan, and every plan comes with monthly credits for creating. Try any plan free, and cancel before the trial ends to pay nothing."
            : "Posting needs a plan, and every plan comes with monthly credits for creating."
        }
      />
      {loading || !plans ? (
        <Spinner className="mx-auto size-6 text-muted-foreground" />
      ) : (
        <div role="radiogroup" aria-label="Plan" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {plans.map((plan) => {
            const active = plan.key === choice;
            const per = intervalLabel(plan.interval);
            return (
              <button
                key={plan.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(plan.key)}
                className={cn(
                  "space-y-1 rounded-xl border bg-card p-4 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "border-foreground ring-1 ring-foreground" : "hover:bg-muted",
                )}
              >
                <span className="flex items-center justify-between text-sm font-medium">
                  {plan.name}
                  {plan.isPopular ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      Popular
                    </span>
                  ) : null}
                </span>
                <span className="block font-display text-xl font-bold">
                  {formatUsd(plan.priceUsd)}
                  {per ? (
                    <span className="text-sm font-normal text-muted-foreground"> / {per}</span>
                  ) : null}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {planCreditsLabel(plan.credits, plan.interval)}
                </span>
                {plan.features?.length ? (
                  <ul className="mt-3 space-y-1.5 border-t pt-3 text-xs">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-1.5">
                        <Check className="mt-px size-3.5 shrink-0 text-muted-foreground" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
      <div className="space-y-2 text-center">
        <Button size="lg" onClick={() => void startCheckout()} disabled={!choice || pending}>
          {pending ? <Spinner /> : null}
          {cta}
        </Button>
        {trialDays ? (
          <p className="text-xs text-muted-foreground">
            You&apos;ll add a card on the next page. You won&apos;t be charged today.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function AgentsStep({ titleRef }: { titleRef: TitleRef }) {
  return (
    <div className="space-y-6">
      <StepHeading
        titleRef={titleRef}
        title="Connect your AI agent"
        description="Use Unsora from Claude, ChatGPT or Cursor: ask in plain words and it creates and schedules for you. You can also do this later from Agents."
      />
      <ConnectAgentTabs />
    </div>
  );
}

/** Sets the onboarding-done flag; rendered once the last step is reached. */
export function MarkOnboarded() {
  const { user } = useUser();
  const done = useRef(false);
  useEffect(() => {
    if (!user || done.current || user.unsafeMetadata?.onboardedAt) return;
    done.current = true;
    void user.update({
      unsafeMetadata: { ...user.unsafeMetadata, onboardedAt: new Date().toISOString() },
    });
  }, [user]);
  return null;
}
