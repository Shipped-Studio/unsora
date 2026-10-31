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
  AgentsStep,
  ChannelsStep,
  ConnectStep,
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
 *   account → channels → how it works → AI agent → free trial
 *
 * An account made while connecting ChatGPT or Claude (`?connect=`) ends by
 * sending them back to connect instead of offering agents:
 *
 *   account → channels → how it works → free trial → connect
 *
 * The free trial is left out for anyone who already has a plan. Finishing
 * (or coming back from a started trial) goes into the app, or on to the
 * connect step.
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

  // Decided once, so starting the trial doesn't reshuffle the steps.
  const [steps, setSteps] = useState<StepId[] | null>(null);
  if (!steps && usage && accounts) {
    const trial: StepId[] = hasPaidPlan(usage) ? [] : ["trial"];
    setSteps(
      app ? ["channels", "howto", ...trial, "connect"] : ["channels", "howto", "agents", ...trial],
    );
  }

  const requested = searchParams.get(SETUP_PARAM) as StepId | null;
  const current = steps ? (requested && steps.includes(requested) ? requested : steps[0]) : null;
  const index = steps && current ? steps.indexOf(current) : 0;
  const last = steps !== null && index === steps.length - 1;

  const hrefFor = (step: StepId, extra: Record<string, string> = {}) => {
    const params = new URLSearchParams(extra);
    if (connectKey) params.set(CONNECT_PARAM, connectKey);
    params.set(SETUP_PARAM, step);
    return `${pathname}?${params.toString()}`;
  };
  // As in the connector setup: instant step changes, and Back goes a step back.
  const go = (step: StepId) => window.history.pushState(null, "", hrefFor(step));

  /** Into the app, keeping the browser's timezone for scheduling. */
  const enterApp = async () => {
    if (usage && !usage.preferences?.timezone) {
      await savePreferences.mutateAsync({ timezone: getBrowserTimezone() }).catch(() => {});
    }
    router.push("/");
  };
  const finish = () => {
    setFinishing(true);
    void enterApp();
  };

  // Back from a started trial: on to connecting the app, or that was the
  // last step.
  const fromCheckout = searchParams.get(CHECKOUT_PARAM) === "success";
  const finished = useRef(false);
  useEffect(() => {
    if (!fromCheckout || !usage || finished.current) return;
    finished.current = true;
    if (app) window.history.replaceState(null, "", hrefFor("connect"));
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
    app,
    hrefFor,
    go,
    next: last ? finish : () => go(steps[index + 1]),
    back: index > 0 ? () => go(steps[index - 1]) : null,
    last,
  };

  return (
    <SetupFrame
      steps={steps}
      current={index}
      appName={app?.name ?? null}
      appIcon={app?.icon}
      homeHref="/"
    >
      {/* Reaching the last steps finishes onboarding, so connecting the app
          after it goes straight to Allow. */}
      {current === "agents" || current === "trial" || current === "connect" ? (
        <MarkOnboarded />
      ) : null}
      <div
        key={current}
        ref={headingRef}
        className="w-full animate-in duration-300 fade-in slide-in-from-bottom-2"
      >
        {current === "channels" ? <ChannelsStep ctx={ctx} /> : null}
        {current === "howto" ? <HowToStep ctx={ctx} /> : null}
        {current === "agents" ? <AgentsStep ctx={ctx} finishing={finishing} /> : null}
        {current === "trial" ? <TrialStep ctx={ctx} /> : null}
        {current === "connect" ? <ConnectStep ctx={ctx} finishing={finishing} /> : null}
      </div>
    </SetupFrame>
  );
}
