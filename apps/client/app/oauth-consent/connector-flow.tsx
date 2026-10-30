"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOAuthConsent, useUser } from "@clerk/nextjs";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import {
  ChannelsStep,
  LearnStep,
  MarkOnboarded,
  ONBOARDING_STEPS,
  OnboardingStepper,
  PLANS_URL,
  type OnboardingStepId,
} from "@/components/onboarding/onboarding-steps";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { useUserUsage } from "@/hooks/use-user-usage";
import { ConsentForm } from "./consent-form";
import { FLOW_PARAMS } from "./flow-params";

/**
 * What an MCP connector (ChatGPT, Claude, …) shows between sign-in and
 * handing back to the client: the same onboarding as the app
 * (components/onboarding/onboarding-steps.tsx), then the consent screen.
 * A new user would otherwise land back in the chat with no channels and no
 * plan, so nothing they ask for would work:
 *
 *   channels → how it works → allow → back to the client
 *
 * Allow also opens the plans in a new tab for anyone without a plan, since
 * Clerk sends this tab straight back to the client. Each step is skippable
 * except the last. Anyone who has finished onboarding (here or in the app),
 * or has a plan and a channel, goes straight to the consent screen; anyone
 * else starts at the first step they still need. The step lives in `?step=`
 * so it survives the OAuth round trip of connecting a channel; every other
 * param is Clerk's request and is left untouched.
 */

type StepId = OnboardingStepId | "allow";

export function ConnectorFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const { usage, loading: usageLoading } = useUserUsage();
  const { data: accounts, isLoading: accountsLoading } = useConnectedAccounts();

  const clientId = searchParams.get("client_id") ?? "";
  const redirectUri = searchParams.get("redirect_uri") ?? "";
  const scope = searchParams.get("scope") ?? undefined;
  const { data: consent, error } = useOAuthConsent({ oauthClientId: clientId, scope, redirectUri });

  // Move focus to the new step's title so screen readers announce it, as the
  // in-app onboarding does.
  const titleRef = useRef<HTMLHeadingElement>(null);
  const stepParam = searchParams.get("step");
  const lastStep = useRef(stepParam);
  useEffect(() => {
    if (lastStep.current === stepParam) return;
    lastStep.current = stepParam;
    titleRef.current?.focus({ preventScroll: true });
  }, [stepParam]);

  if (!clientId || !redirectUri) {
    return (
      <ConsentProblem message="This connection link is incomplete. Start the connection again from the app you're connecting." />
    );
  }
  if (error) {
    return (
      <ConsentProblem message="We couldn't load this connection request. It may have expired, so start it again from the app you're connecting." />
    );
  }
  if (!consent || usageLoading || accountsLoading || !usage || !user) {
    return <Spinner className="mx-auto size-6 text-muted-foreground" />;
  }

  const appName = consent.oauthApplicationName || "This app";
  const returnHost = consent.redirectDomain || hostname(redirectUri);
  const plan = (usage.user.plan ?? "free").toLowerCase();
  const isPaid = usage.user.isActive && plan !== "free";
  const accountCount = accounts?.length ?? 0;
  const onboarded = Boolean(user.unsafeMetadata?.onboardedAt);

  const steps: { id: StepId; label: string }[] = [
    ...ONBOARDING_STEPS,
    { id: "allow", label: "Connect" },
  ];
  const requested = searchParams.get("step") as StepId | null;
  // Where to start: skip what's already done.
  const fallback: StepId =
    onboarded || (isPaid && accountCount > 0) ? "allow" : accountCount === 0 ? "channels" : "learn";
  const step = steps.some((s) => s.id === requested) ? (requested as StepId) : fallback;
  const index = steps.findIndex((s) => s.id === step);

  /** This URL with `step` set and the one-off return params dropped. */
  const urlFor = (next: StepId) => {
    const params = new URLSearchParams(searchParams);
    for (const key of FLOW_PARAMS) params.delete(key);
    params.set("step", next);
    return `${pathname}?${params}`;
  };
  const go = (next: StepId) => router.replace(urlFor(next), { scroll: false });
  const nextStep = () => go(steps[index + 1]?.id ?? "allow");
  const prevStep = index > 0 ? () => go(steps[index - 1].id) : null;
  // Came through the steps (`?step=` is set): keep the stepper, even once
  // reaching the consent screen marks onboarding done.
  const showSteps = requested !== null || fallback !== "allow";

  if (step === "allow") {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-8">
        {/* Reaching the consent screen finishes onboarding, here and in the app. */}
        {onboarded ? null : <MarkOnboarded />}
        {showSteps ? <OnboardingStepper steps={steps} current={index} /> : null}
        <div className="mx-auto w-full max-w-sm">
          <ConsentForm
            clientId={clientId}
            appName={appName}
            logoUrl={consent.oauthApplicationLogoUrl}
            returnHost={returnHost}
            email={user.primaryEmailAddress?.emailAddress ?? user.username ?? null}
            scopes={scope?.split(" ") ?? []}
            credits={usage.credits}
            accountCount={accountCount}
            plansUrl={isPaid ? null : PLANS_URL}
          />
        </div>
        {prevStep && showSteps ? (
          <div className="text-center">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={prevStep}>
              <ArrowLeft />
              Back
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <OnboardingStepper steps={steps} current={index} />

      {step === "channels" ? (
        <ChannelsStep titleRef={titleRef} agentName={appName} returnTo={urlFor("channels")} />
      ) : (
        <LearnStep titleRef={titleRef} agentName={appName} />
      )}

      <div className="flex items-center justify-between gap-3">
        {prevStep ? (
          <Button variant="ghost" onClick={prevStep}>
            <ArrowLeft />
            Back
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {step === "channels" && accountCount === 0 ? (
            <Button variant="ghost" onClick={nextStep}>
              Skip for now
            </Button>
          ) : (
            <Button onClick={nextStep}>
              Continue
              <ArrowRight />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ConsentProblem({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-sm space-y-4 text-center">
      <h1 className="font-display text-2xl font-bold tracking-[-0.03em] text-foreground">
        Can&apos;t connect this app
      </h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link href="/" className={buttonVariants({ variant: "secondary" })}>
        Open Unsora
      </Link>
    </div>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "the app";
  }
}
