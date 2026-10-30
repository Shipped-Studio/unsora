"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
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
  HowToStep,
  TrialStep,
} from "@/components/onboarding/setup-steps";
import { Spinner } from "@/components/ui/spinner";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { useUpdatePreferences } from "@/hooks/use-schedule";
import { useUserUsage } from "@/hooks/use-user-usage";
import { getBrowserTimezone } from "@/lib/timezone";

/**
 * First-run setup after sign-up, as its own page. The same setup as an AI
 * app connecting through the MCP connector (app/oauth-consent), with
 * connecting an agent in place of the consent screen:
 *
 *   account → channels → how it works → AI agent → free trial
 *
 * The free trial is left out for anyone who already has a plan. Finishing
 * (or coming back from a started trial) goes into the app.
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

  // Decided once, so starting the trial doesn't reshuffle the steps.
  const [steps, setSteps] = useState<StepId[] | null>(null);
  if (!steps && usage && accounts) {
    setSteps(["channels", "howto", "agents", ...(hasPaidPlan(usage) ? [] : (["trial"] as const))]);
  }

  const requested = searchParams.get(SETUP_PARAM) as StepId | null;
  const current = steps ? (requested && steps.includes(requested) ? requested : steps[0]) : null;
  const index = steps && current ? steps.indexOf(current) : 0;
  const last = steps !== null && index === steps.length - 1;

  const hrefFor = (step: StepId, extra: Record<string, string> = {}) => {
    const params = new URLSearchParams(extra);
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

  // Back from a started trial: that was the last step.
  const fromCheckout = searchParams.get(CHECKOUT_PARAM) === "success";
  const finished = useRef(false);
  useEffect(() => {
    if (!fromCheckout || !usage || finished.current) return;
    finished.current = true;
    void enterApp();
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
    appName: null,
    appLogoUrl: null,
    hrefFor,
    go,
    next: last ? finish : () => go(steps[index + 1]),
    back: index > 0 ? () => go(steps[index - 1]) : null,
    last,
  };

  return (
    <SetupFrame steps={steps} current={index} appName={null} homeHref="/">
      {/* Reaching the agent step finishes onboarding, here and for agent connections. */}
      {current === "agents" || current === "trial" ? <MarkOnboarded /> : null}
      <div
        key={current}
        ref={headingRef}
        className="w-full animate-in duration-300 fade-in slide-in-from-bottom-2"
      >
        {current === "channels" ? <ChannelsStep ctx={ctx} /> : null}
        {current === "howto" ? <HowToStep ctx={ctx} /> : null}
        {current === "agents" ? <AgentsStep ctx={ctx} finishing={finishing} /> : null}
        {current === "trial" ? <TrialStep ctx={ctx} /> : null}
      </div>
    </SetupFrame>
  );
}
