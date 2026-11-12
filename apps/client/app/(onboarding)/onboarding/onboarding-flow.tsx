"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { CONNECT_PARAM, connectorApp } from "@/components/onboarding/connector-app";
import { CreditPlansStep, CreditsAskStep, PlanStep } from "@/components/onboarding/credits-steps";
import { MarkOnboarded } from "@/components/onboarding/mark-onboarded";
import {
  CHECKOUT_PARAM,
  CREDITS_PLAN_PARAM,
  MONTHLY_VIEW,
  SETUP_PARAM,
  VIEW_PARAM,
  hasPaidPlan,
  normalizeStep,
  type SetupContext,
  type StepId,
} from "@/components/onboarding/setup";
import { SetupFrame } from "@/components/onboarding/setup-frame";
import {
  ChannelsStep,
  ConnectStep,
  HowToStep,
  SourceStep,
  TrialStep,
} from "@/components/onboarding/setup-steps";
import { Spinner } from "@/components/ui/spinner";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { useUpdatePreferences } from "@/hooks/use-schedule";
import { hasCreditPlan, useUserUsage } from "@/hooks/use-user-usage";
import { getBrowserTimezone } from "@/lib/timezone";

/**
 * First-run setup after sign-up, as its own page:
 *
 *   account → where you heard about us → channels → how it works → free trial → credits
 *
 * An account made while connecting ChatGPT or Claude (`?connect=`) gets the
 * same steps, then one asking it to connect again from that app:
 *
 *   account → where you heard about us → channels → how it works → free trial → credits → connect
 *
 * The free trial is left out for anyone who already has a plan; for
 * everyone else it can't be skipped, since the app needs a plan. Coming back
 * from a started trial moves on a step, to credits: the trial doesn't include
 * any, so that step offers them, and it can be skipped. Finishing goes into the app, straight to a first post for
 * anyone who can post already.
 */
export function OnboardingFlow() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const { usage } = useUserUsage();
  const { data: accounts } = useConnectedAccounts();
  const savePreferences = useUpdatePreferences();
  const [finishing, setFinishing] = useState(false);
  const connectKey = searchParams.get(CONNECT_PARAM);
  const app = connectorApp(connectKey);

  const fromCheckout = searchParams.get(CHECKOUT_PARAM) === "success";
  const requested = normalizeStep(searchParams.get(SETUP_PARAM));
  const paid = hasPaidPlan(usage);
  // Stripe's return is a full page load, and moving on from it drops the
  // param. The webhook may still be behind, so remember the plan is coming.
  const [startedPlan] = useState(fromCheckout);
  // Monthly credits count as a plan too (the credits-only way in).
  const [startedCredits] = useState(searchParams.get(CREDITS_PLAN_PARAM) === "success");
  const anyPlan = paid || startedPlan || hasCreditPlan(usage) || startedCredits;

  // Decided once, so starting the trial doesn't reshuffle the steps. Back
  // from the trial's checkout the plan may show already; the trial step
  // stays so the flow can move on from it, and credits stays through a
  // reload or a purchase's checkout, by when the plan shows.
  const [steps, setSteps] = useState<StepId[] | null>(null);
  if (!steps && usage && accounts && user) {
    // The plan step until there's a plan. The credits add-on joins it once a
    // trial has started (back from its checkout, or a reload after).
    const backFromTrial = fromCheckout && requested === "plan";
    const trialStarted = paid || backFromTrial || requested === "credits";
    const plan: StepId[] =
      paid && !backFromTrial && requested !== "credits" && requested !== "plan"
        ? []
        : trialStarted
          ? ["plan", "credits"]
          : ["plan"];
    const source: StepId[] = user.unsafeMetadata?.heardFrom ? [] : ["source"];
    setSteps([...source, "channels", "howto", ...plan, ...(app ? (["connect"] as const) : [])]);
  }

  const current = steps ? (requested && steps.includes(requested) ? requested : steps[0]) : null;
  const index = steps && current ? steps.indexOf(current) : 0;
  const nextStep = steps?.[index + 1] ?? null;
  const prevStep = index > 0 ? (steps?.[index - 1] ?? null) : null;
  const last = steps !== null && nextStep === null;

  const hrefFor = (step: StepId, extra: Record<string, string> = {}) => {
    const params = new URLSearchParams(extra);
    if (connectKey) params.set(CONNECT_PARAM, connectKey);
    params.set(SETUP_PARAM, step);
    return `${pathname}?${params.toString()}`;
  };
  // As in the connector setup: instant step changes, and Back goes a step back.
  const go = (step: StepId) => window.history.pushState(null, "", hrefFor(step));

  const canPost = (paid || startedPlan) && (accounts?.length ?? 0) > 0;

  /** Into the app, keeping the browser's timezone for scheduling. */
  const enterApp = async () => {
    if (usage && !usage.preferences?.timezone) {
      await savePreferences.mutateAsync({ timezone: getBrowserTimezone() }).catch(() => {});
    }
    // The app sends new accounts back here until they're marked onboarded
    // (mustFinishOnboarding). MarkOnboarded saves the flag in the background,
    // so make sure it has landed before going in, or a quick click races it.
    if (user && !user.unsafeMetadata?.onboardedAt && anyPlan) {
      await user
        .update({ unsafeMetadata: { ...user.unsafeMetadata, onboardedAt: new Date().toISOString() } })
        .catch(() => {});
    }
    router.push(canPost ? "/scheduler/new" : "/");
  };
  const finish = () => {
    setFinishing(true);
    void enterApp();
  };

  // Back from Stripe: on to the step after the one that sent them there,
  // or that was the last one.
  const finished = useRef(false);
  useEffect(() => {
    if (!fromCheckout || !usage || !steps || !current || finished.current) return;
    finished.current = true;
    const after = steps[index + 1];
    if (after) window.history.replaceState(null, "", hrefFor(after));
    else void enterApp();
  });

  // Focus the new step's heading so screen readers announce it.
  const headingRef = useRef<HTMLDivElement>(null);
  const monthlyView = current === "credits" && searchParams.get(VIEW_PARAM) === MONTHLY_VIEW;
  // Each of the credits step's screens gets its own heading focus and entrance.
  const screen = `${current}-${searchParams.get(VIEW_PARAM)}-${searchParams.get(CREDITS_PLAN_PARAM)}`;
  const lastStep = useRef(screen);
  useEffect(() => {
    if (lastStep.current === screen) return;
    lastStep.current = screen;
    headingRef.current?.querySelector("h1")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [screen]);

  if (!user || !steps || !current || fromCheckout) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
        {/* Back from a started trial: the plan is in place. */}
        {fromCheckout ? <MarkOnboarded /> : null}
      </div>
    );
  }

  const ctx: SetupContext = {
    hrefFor,
    go,
    next: nextStep ? () => go(nextStep) : finish,
    back: prevStep ? () => go(prevStep) : null,
    last,
  };

  return (
    <SetupFrame steps={steps} current={index} appName={null} homeHref="/">
      {/* Onboarding counts as done once there's a plan and the last step is
          reached, so connecting the app after it goes straight to Allow.
          Without a plan it isn't done, and the next sign-in comes back here. */}
      {last && (hasPaidPlan(usage) || hasCreditPlan(usage)) ? <MarkOnboarded /> : null}
      <div
        key={screen}
        ref={headingRef}
        className="flex w-full flex-col animate-in duration-300 fade-in slide-in-from-bottom-2"
      >
        {current === "channels" ? <ChannelsStep ctx={ctx} /> : null}
        {current === "howto" ? <HowToStep ctx={ctx} app={app} /> : null}
        {current === "plan" ? (
          <PlanStep ctx={ctx} finishing={finishing} scheduler={<TrialStep ctx={ctx} />} />
        ) : null}
        {current === "credits" && !monthlyView ? <CreditsAskStep ctx={ctx} finishing={finishing} /> : null}
        {monthlyView ? <CreditPlansStep ctx={ctx} finishing={finishing} /> : null}
        {current === "source" ? <SourceStep ctx={ctx} finishing={finishing} /> : null}
        {current === "connect" && app ? (
          <ConnectStep ctx={ctx} app={app} finishing={finishing} />
        ) : null}
      </div>
    </SetupFrame>
  );
}
