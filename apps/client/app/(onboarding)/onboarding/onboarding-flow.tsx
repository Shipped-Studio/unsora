"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { CONNECT_PARAM, connectorApp } from "@/components/onboarding/connector-app";
import { MarkOnboarded } from "@/components/onboarding/mark-onboarded";
import {
  CHECKOUT_PARAM,
  SETUP_PARAM,
  hasPaidPlan,
  type SetupContext,
  type StepId,
} from "@/components/onboarding/setup";
import { SetupFrame } from "@/components/onboarding/setup-frame";
import {
  ChannelsStep,
  ConnectStep,
  CreditsStep,
  HowToStep,
  TrialStep,
} from "@/components/onboarding/setup-steps";
import { Spinner } from "@/components/ui/spinner";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { useUpdatePreferences } from "@/hooks/use-schedule";
import { useUserUsage } from "@/hooks/use-user-usage";
import { getBrowserTimezone } from "@/lib/timezone";

/**
 * First-run setup after sign-up, as its own page:
 *
 *   account → channels → how it works → free trial → credits
 *
 * An account made while connecting ChatGPT or Claude (`?connect=`) gets the
 * same steps, then one asking it to connect again from that app:
 *
 *   account → channels → how it works → free trial → credits → connect
 *
 * The free trial is left out for anyone who already has a plan. Credits
 * (top-ups, as plans include none) needs a plan or trial, so it's skipped
 * without one. Coming back from Stripe (a started trial or a bought pack)
 * moves on a step. Finishing goes into the app, straight to a first post for
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
  const requested = searchParams.get(SETUP_PARAM) as StepId | null;
  const paid = hasPaidPlan(usage);

  // Decided once, so starting the trial doesn't reshuffle the steps. Back
  // from the trial's checkout the plan may show already; the trial step
  // stays so the flow can move on from it.
  const [steps, setSteps] = useState<StepId[] | null>(null);
  if (!steps && usage && accounts) {
    const backFromTrial = fromCheckout && requested === "trial";
    const trial: StepId[] = paid && !backFromTrial ? [] : ["trial"];
    setSteps(["channels", "howto", ...trial, "credits", ...(app ? (["connect"] as const) : [])]);
  }

  const current = steps ? (requested && steps.includes(requested) ? requested : steps[0]) : null;
  const index = steps && current ? steps.indexOf(current) : 0;
  // Buying credits needs a plan or trial; without one that step is passed over.
  const skipped = (step: StepId) => step === "credits" && !paid;
  const nextStep = steps?.slice(index + 1).find((step) => !skipped(step)) ?? null;
  const prevStep = steps?.slice(0, index).reverse().find((step) => !skipped(step)) ?? null;
  const last = steps !== null && nextStep === null;

  const hrefFor = (step: StepId, extra: Record<string, string> = {}) => {
    const params = new URLSearchParams(extra);
    if (connectKey) params.set(CONNECT_PARAM, connectKey);
    params.set(SETUP_PARAM, step);
    return `${pathname}?${params.toString()}`;
  };
  // As in the connector setup: instant step changes, and Back goes a step back.
  const go = (step: StepId) => window.history.pushState(null, "", hrefFor(step));

  const canPost = (paid || fromCheckout) && (accounts?.length ?? 0) > 0;

  /** Into the app, keeping the browser's timezone for scheduling. */
  const enterApp = async () => {
    if (usage && !usage.preferences?.timezone) {
      await savePreferences.mutateAsync({ timezone: getBrowserTimezone() }).catch(() => {});
    }
    router.push(canPost ? "/scheduler/new" : "/");
  };
  const finish = () => {
    setFinishing(true);
    void enterApp();
  };

  // Back from Stripe: on to the step after the one that sent them there,
  // or that was the last one. Not skipping Credits here: the trial that
  // was just started may not show on the account yet.
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
  const lastStep = useRef(current);
  useEffect(() => {
    if (lastStep.current === current) return;
    lastStep.current = current;
    headingRef.current?.querySelector("h1")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [current]);

  if (!user || !steps || !current || fromCheckout) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
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
      {/* Reaching the last steps finishes onboarding, so connecting the app
          after it goes straight to Allow. */}
      {current === "trial" || last ? (
        <MarkOnboarded />
      ) : null}
      <div
        key={current}
        ref={headingRef}
        className="w-full animate-in duration-300 fade-in slide-in-from-bottom-2"
      >
        {current === "channels" ? <ChannelsStep ctx={ctx} /> : null}
        {current === "howto" ? <HowToStep ctx={ctx} /> : null}
        {current === "trial" ? <TrialStep ctx={ctx} /> : null}
        {current === "credits" ? <CreditsStep ctx={ctx} finishing={finishing} /> : null}
        {current === "connect" && app ? (
          <ConnectStep ctx={ctx} app={app} finishing={finishing} />
        ) : null}
      </div>
    </SetupFrame>
  );
}
