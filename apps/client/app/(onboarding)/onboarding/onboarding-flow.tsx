"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, ArrowRight, CheckCircle } from "@phosphor-icons/react";
import {
  AgentsStep,
  ChannelsStep,
  LearnStep,
  MarkOnboarded,
  ONBOARDING_STEPS,
  OnboardingStepper,
  TrialStep,
  type OnboardingStepId,
} from "@/components/onboarding/onboarding-steps";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { useUpdatePreferences } from "@/hooks/use-schedule";
import { useTrialDays } from "@/hooks/use-subscription-plans";
import { useUserUsage } from "@/hooks/use-user-usage";
import { getBrowserTimezone } from "@/lib/timezone";

/**
 * First-run setup after sign-up, as its own page: the shared onboarding
 * steps (onboarding-steps.tsx), then connecting an AI agent, where an agent
 * connection shows its consent screen instead. Anyone without a plan then
 * gets the plans, which aren't a numbered step (the consent screen opens
 * this page at ?step=plans after Allow). The step lives in `?step=` so it
 * survives the OAuth round trip of connecting a channel and the Stripe
 * checkout.
 */

type StepId = OnboardingStepId | "agents" | "plans";

const PATH = "/onboarding";

export function OnboardingFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useUser();
  const { usage } = useUserUsage();
  const { data: accounts } = useConnectedAccounts();
  const trialDays = useTrialDays(true);
  const savePreferences = useUpdatePreferences();
  const [finishing, setFinishing] = useState(false);

  const trialStarted =
    searchParams.get("trial") === "started" || searchParams.get("checkout") === "success";
  const plan = (usage?.user?.plan ?? "free").toLowerCase();
  const isPaid = Boolean(usage?.user?.isActive) && plan !== "free";
  const steps: { id: StepId; label: string }[] = [
    ...ONBOARDING_STEPS,
    { id: "agents", label: "Connect" },
  ];
  // The plans follow the steps for anyone without a plan (or just back from
  // starting one), and the stepper shows every step done.
  const showPlans = !isPaid || trialStarted;
  const requested = searchParams.get("step");
  const step: StepId =
    requested === "plans" && showPlans
      ? "plans"
      : (steps.find((s) => s.id === requested)?.id ?? "channels");
  const index = step === "plans" ? steps.length : steps.findIndex((s) => s.id === step);
  const hasChannels = (accounts?.length ?? 0) > 0;

  const urlFor = (next: StepId) =>
    `${PATH}?step=${next}${trialStarted ? "&trial=started" : ""}`;
  const go = (next: StepId) => router.replace(urlFor(next), { scroll: false });
  const back = index > 0 ? steps[index - 1].id : null;
  const forward = index < steps.length - 1 ? steps[index + 1].id : null;

  // Move focus to the new step's title so the next control doesn't light up
  // with a focus ring, and screen readers announce the step.
  const titleRef = useRef<HTMLHeadingElement>(null);
  const lastStep = useRef(step);
  useEffect(() => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    titleRef.current?.focus({ preventScroll: true });
  }, [step]);

  /** Into the app, keeping the browser's timezone for scheduling. */
  const finish = async () => {
    setFinishing(true);
    if (usage && !usage.preferences?.timezone) {
      await savePreferences.mutateAsync({ timezone: getBrowserTimezone() }).catch(() => {});
    }
    router.push("/");
  };

  if (!usage || !user) {
    return <Spinner className="mx-auto size-6 text-muted-foreground" />;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      {/* Reaching the last step finishes onboarding, here and for agent connections. */}
      {step === "agents" || step === "plans" ? <MarkOnboarded /> : null}
      <OnboardingStepper steps={steps} current={index} />

      {step === "channels" ? (
        <ChannelsStep titleRef={titleRef} returnTo={urlFor("channels")} />
      ) : step === "learn" ? (
        <LearnStep titleRef={titleRef} />
      ) : step === "agents" ? (
        <AgentsStep titleRef={titleRef} />
      ) : (
        <TrialStep
          titleRef={titleRef}
          trialDays={trialDays}
          started={trialStarted}
          returnPath={urlFor("plans")}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        {back ? (
          <Button variant="ghost" onClick={() => go(back)}>
            <ArrowLeft />
            Back
          </Button>
        ) : (
          <span />
        )}
        {step === "plans" && !trialStarted ? (
          // Starting the trial is the step's own button; this is the way out.
          <Button variant="ghost" onClick={() => void finish()} disabled={finishing}>
            {finishing ? <Spinner /> : null}
            Maybe later
          </Button>
        ) : step === "plans" || (step === "agents" && !showPlans) ? (
          <Button onClick={() => void finish()} disabled={finishing}>
            {finishing ? <Spinner /> : <CheckCircle />}
            Get started
          </Button>
        ) : step === "channels" && !hasChannels ? (
          <Button variant="ghost" onClick={() => go("learn")}>
            Skip for now
          </Button>
        ) : (
          <Button onClick={() => go(forward ?? "plans")}>
            Continue
            <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}
