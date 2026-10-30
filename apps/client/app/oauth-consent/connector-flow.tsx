"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOAuthConsent, useUser } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  CheckCircle,
  FilmSlate,
  Scissors,
  Sparkle,
} from "@phosphor-icons/react";
import { EXAMPLE_PROMPTS } from "@/components/agents/connect-agent-tabs";
import { CopyButton } from "@/components/api-keys/copy-button";
import { formatUsd, intervalLabel, planCreditsLabel } from "@/components/billing/format";
import { redirectToStripe } from "@/components/billing/redirect-to-stripe";
import { AccountAvatar, accountLabel } from "@/components/scheduler/account-avatar";
import { ConnectGrid } from "@/components/scheduler/accounts-view";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { useSubscriptionPlans, useTrialDays } from "@/hooks/use-subscription-plans";
import { userUsageQueryKeys, useUserUsage } from "@/hooks/use-user-usage";
import { cn } from "@/lib/utils";
import { ConsentForm } from "./consent-form";
import { FLOW_PARAMS } from "./flow-params";

/**
 * What an MCP connector (ChatGPT, Claude, …) shows between sign-in and
 * handing back to the client. A new user would otherwise land back in the
 * chat with no channels and no credits, so nothing they ask for would work:
 *
 *   channels → how it works → free trial → allow → back to the client
 *
 * Each step is skippable except the last. Set-up users (a plan and at least
 * one channel) go straight to the consent screen. The step lives in `?step=`
 * so it survives the OAuth round trip of connecting a channel and the Stripe
 * checkout; every other param is Clerk's request and is left untouched.
 */

type StepId = "channels" | "learn" | "trial" | "allow";

export function ConnectorFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { usage, loading: usageLoading } = useUserUsage();
  const { data: accounts, isLoading: accountsLoading } = useConnectedAccounts();
  const trialDays = useTrialDays(true);

  const clientId = searchParams.get("client_id") ?? "";
  const redirectUri = searchParams.get("redirect_uri") ?? "";
  const scope = searchParams.get("scope") ?? undefined;
  const { data: consent, error } = useOAuthConsent({ oauthClientId: clientId, scope, redirectUri });

  const checkout = searchParams.get("checkout");
  const trialStarted = searchParams.get("trial") === "started" || checkout === "success";

  // Back from Stripe: the webhook may land a moment later, so read usage again.
  const refetched = useRef(false);
  useEffect(() => {
    if (checkout !== "success" || refetched.current) return;
    refetched.current = true;
    void queryClient.invalidateQueries({ queryKey: userUsageQueryKeys.usage() });
  }, [checkout, queryClient]);

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
  if (!consent || usageLoading || accountsLoading || !usage) {
    return <Spinner className="mx-auto size-6 text-muted-foreground" />;
  }

  const appName = consent.oauthApplicationName || "This app";
  const returnHost = consent.redirectDomain || hostname(redirectUri);
  const plan = (usage.user.plan ?? "free").toLowerCase();
  const isPaid = usage.user.isActive && plan !== "free";
  const accountCount = accounts?.length ?? 0;

  const steps: { id: StepId; label: string }[] = [
    { id: "channels", label: "Channels" },
    { id: "learn", label: "How it works" },
    ...(isPaid && !trialStarted
      ? []
      : [{ id: "trial" as const, label: trialDays ? "Free trial" : "Plan" }]),
    { id: "allow", label: "Connect" },
  ];
  const requested = searchParams.get("step") as StepId | null;
  const fallback: StepId = isPaid && accountCount > 0 ? "allow" : "channels";
  const step = steps.some((s) => s.id === requested) ? (requested as StepId) : fallback;
  const index = steps.findIndex((s) => s.id === step);

  /** This URL with `step` set and the one-off return params dropped. */
  const urlFor = (next: StepId, extra: Record<string, string> = {}) => {
    const params = new URLSearchParams(searchParams);
    for (const key of FLOW_PARAMS) params.delete(key);
    params.set("step", next);
    if (trialStarted) params.set("trial", "started");
    for (const [key, value] of Object.entries(extra)) params.set(key, value);
    return `${pathname}?${params}`;
  };
  const go = (next: StepId) => router.replace(urlFor(next), { scroll: false });
  const nextStep = () => go(steps[index + 1]?.id ?? "allow");
  const prevStep = index > 0 ? () => go(steps[index - 1].id) : null;

  if (step === "allow") {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-8">
        {steps.length > 1 && fallback !== "allow" ? <Stepper steps={steps} current={index} /> : null}
        <div className="mx-auto w-full max-w-sm">
          <ConsentForm
            clientId={clientId}
            appName={appName}
            logoUrl={consent.oauthApplicationLogoUrl}
            returnHost={returnHost}
            email={user?.primaryEmailAddress?.emailAddress ?? user?.username ?? null}
            scopes={scope?.split(" ") ?? []}
            credits={usage.credits}
            accountCount={accountCount}
            noCreditsWarning={!isPaid && !trialStarted && usage.credits <= 0}
            onStartTrial={steps.some((s) => s.id === "trial") ? () => go("trial") : undefined}
          />
        </div>
        {prevStep && fallback !== "allow" ? (
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
      <Stepper steps={steps} current={index} />

      {step === "channels" ? (
        <ChannelsStep
          titleRef={titleRef}
          appName={appName}
          returnTo={urlFor("channels")}
          accounts={accounts ?? []}
        />
      ) : step === "learn" ? (
        <LearnStep titleRef={titleRef} appName={appName} />
      ) : (
        <TrialStep
          titleRef={titleRef}
          appName={appName}
          trialDays={trialDays}
          started={trialStarted}
          returnPath={urlFor("trial")}
        />
      )}

      <div className="flex items-center justify-between gap-3 border-t pt-5">
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
          ) : null}
          {step === "trial" && !trialStarted ? (
            <Button variant="ghost" onClick={nextStep}>
              Maybe later
            </Button>
          ) : null}
          {!(step === "channels" && accountCount === 0) && !(step === "trial" && !trialStarted) ? (
            <Button onClick={nextStep}>
              Continue
              <ArrowRight />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Stepper({ steps, current }: { steps: { id: string; label: string }[]; current: number }) {
  return (
    <ol className="flex items-center justify-center gap-2 text-xs sm:gap-3 sm:text-sm">
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
            <span className={cn(i !== current && "hidden sm:inline")}>{s.label}</span>
          </span>
          {i < steps.length - 1 ? (
            <span aria-hidden className="h-px w-4 bg-border sm:w-8" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

type TitleRef = React.RefObject<HTMLHeadingElement | null>;

function StepHeading({
  titleRef,
  title,
  description,
}: {
  titleRef: TitleRef;
  title: string;
  description: React.ReactNode;
}) {
  return (
    <div className="space-y-2 text-center">
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

function ChannelsStep({
  titleRef,
  appName,
  returnTo,
  accounts,
}: {
  titleRef: TitleRef;
  appName: string;
  returnTo: string;
  accounts: NonNullable<ReturnType<typeof useConnectedAccounts>["data"]>;
}) {
  return (
    <div className="space-y-6">
      <StepHeading
        titleRef={titleRef}
        title="Connect your social accounts"
        description={`So ${appName} can schedule and publish for you. You can add more any time in Unsora.`}
      />
      {accounts.length ? (
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
  { icon: FilmSlate, title: "Check results", body: "Ask how your posts did and what to post next." },
];

function LearnStep({ titleRef, appName }: { titleRef: TitleRef; appName: string }) {
  return (
    <div className="space-y-6">
      <StepHeading
        titleRef={titleRef}
        title={`How to use Unsora in ${appName}`}
        description={`Just ask in plain words. ${appName} picks the right Unsora tool and shows you the result.`}
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
        <p className="text-sm font-medium">Try asking</p>
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

function TrialStep({
  titleRef,
  appName,
  trialDays,
  started,
  returnPath,
}: {
  titleRef: TitleRef;
  appName: string;
  trialDays: number | null;
  started: boolean;
  returnPath: string;
}) {
  const { authFetch } = useAuthFetch();
  const { plans, loading } = useSubscriptionPlans();
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (started) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle weight="fill" className="mx-auto size-12 text-success" />
        <StepHeading
          titleRef={titleRef}
          title="You're all set"
          description={`Your plan is active and your credits are on the way. One last step: let ${appName} use your Unsora account.`}
        />
      </div>
    );
  }

  const choice =
    selected ?? plans?.find((p) => p.isPopular)?.key ?? plans?.[0]?.key ?? null;
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
            ? "Creating and posting use credits, and new accounts start with none. Try any plan free, and cancel before the trial ends to pay nothing."
            : "Creating and posting use credits. Pick a plan to get your monthly credits."
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
                  {per ? <span className="text-sm font-normal text-muted-foreground"> / {per}</span> : null}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {planCreditsLabel(plan.credits, plan.interval)}
                </span>
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
