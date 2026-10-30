"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useOAuthConsent, useUser } from "@clerk/nextjs";
import { UnsoraLogo } from "@/components/brand/unsora-logo";
import { MarkOnboarded } from "@/components/onboarding/mark-onboarded";
import {
  CHECKOUT_PARAM,
  SETUP_PARAM,
  hasPaidPlan,
  type SetupContext,
  type StepId,
} from "@/components/onboarding/setup";
import { SetupFrame } from "@/components/onboarding/setup-frame";
import { ChannelsStep, HowToStep, TrialStep } from "@/components/onboarding/setup-steps";
import { buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { useUserUsage } from "@/hooks/use-user-usage";
import { AuthShowcase } from "@/app/(auth)/_components/auth-showcase";
import { AccountStep } from "./account-step";
import { ConsentForm } from "./consent-form";
import { OWN_PARAMS } from "./setup-params";

/**
 * What an MCP connector (ChatGPT, Claude, …) shows between its OAuth request
 * and handing back to it. A new user would otherwise land back in the chat
 * with no channels and no plan, so nothing they ask for would work:
 *
 *   account → channels → how it works → free trial → allow
 *
 * The same setup as the app's own onboarding (components/onboarding), with
 * the consent screen as its last step. Anyone who finished either one, or
 * has a plan and a channel, goes straight to Allow.
 */
export function ConnectorSetup() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user, isLoaded, isSignedIn } = useUser();
  const { usage } = useUserUsage();
  const { data: accounts } = useConnectedAccounts();

  const clientId = searchParams.get("client_id") ?? "";
  const redirectUri = searchParams.get("redirect_uri") ?? "";
  const scope = searchParams.get("scope") ?? undefined;
  const { data: consent, error } = useOAuthConsent({
    oauthClientId: clientId,
    scope,
    redirectUri,
  });

  // Decided once, from the account as it was when the page opened, so
  // connecting a channel or starting the trial doesn't reshuffle the steps.
  const [steps, setSteps] = useState<StepId[] | null>(null);
  const allSteps = (): StepId[] =>
    ["channels", "howto", ...(hasPaidPlan(usage) ? [] : (["trial"] as const)), "allow"];
  if (!steps && isLoaded && user && usage && accounts) {
    const setUp =
      Boolean(user.unsafeMetadata.onboardedAt) || (hasPaidPlan(usage) && accounts.length > 0);
    setSteps(setUp ? ["allow"] : allSteps());
  }

  // Back from a started trial, Allow is next (it waits for the plan to show).
  const fromCheckout = searchParams.get(CHECKOUT_PARAM) === "success";
  const requested = fromCheckout ? "allow" : (searchParams.get(SETUP_PARAM) as StepId | null);
  const current = steps
    ? requested && steps.includes(requested)
      ? requested
      : steps[0]
    : null;
  const index = steps && current ? steps.indexOf(current) : 0;

  const hrefFor = (step: StepId, extra: Record<string, string> = {}) => {
    const params = new URLSearchParams(searchParams);
    for (const key of OWN_PARAMS) params.delete(key);
    params.set(SETUP_PARAM, step);
    for (const [key, value] of Object.entries(extra)) params.set(key, value);
    return `${pathname}?${params.toString()}`;
  };
  // The native history API updates useSearchParams without a server round
  // trip, so steps switch instantly, and the browser's Back goes a step back.
  const go = (step: StepId) => {
    // Skipped straight to Allow, then asked for a step from there ("None
    // yet", "No plan"): bring the whole setup back.
    if (steps && !steps.includes(step)) setSteps(allSteps());
    window.history.pushState(null, "", hrefFor(step));
  };

  // Stripe returns to the trial step; show the URL of the step on screen.
  useEffect(() => {
    if (fromCheckout && searchParams.get(SETUP_PARAM) !== "allow") {
      window.history.replaceState(null, "", hrefFor("allow", { [CHECKOUT_PARAM]: "success" }));
    }
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

  if (!clientId || !redirectUri) {
    return (
      <Problem message="This connection link is incomplete. Start the connection again from the app you're connecting." />
    );
  }
  if (error) {
    return (
      <Problem message="We couldn't load this connection request. It may have expired, so start it again from the app you're connecting." />
    );
  }
  // Signed out: Unsora's own sign-in / sign-up, the same front door as the
  // rest of the app. The connecting app only shows up in the steps after it.
  if (isLoaded && !isSignedIn) {
    return (
      <AuthFrame>
        <AccountStep />
      </AuthFrame>
    );
  }
  if (!consent || !steps || !current) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  const appName = consent.oauthApplicationName || appNameFromRedirect(redirectUri);
  const ctx: SetupContext = {
    appName,
    appLogoUrl: consent.oauthApplicationLogoUrl,
    hrefFor,
    go,
    next: () => go(steps[Math.min(index + 1, steps.length - 1)]),
    back: index > 0 ? () => go(steps[index - 1]) : null,
    last: index === steps.length - 1,
  };

  return (
    <SetupFrame
      steps={steps}
      current={index}
      appName={appName}
      appLogoUrl={consent.oauthApplicationLogoUrl}
      homeHref="https://tryunsora.com"
    >
      {/* Reaching the consent screen finishes setup, here and in the app. */}
      {current === "allow" ? <MarkOnboarded /> : null}
      <div
        key={current}
        ref={headingRef}
        className="w-full animate-in duration-300 fade-in slide-in-from-bottom-2"
      >
        {current === "channels" ? <ChannelsStep ctx={ctx} /> : null}
        {current === "howto" ? <HowToStep ctx={ctx} /> : null}
        {current === "trial" ? <TrialStep ctx={ctx} /> : null}
        {current === "allow" ? <ConsentForm ctx={ctx} consent={consent} /> : null}
      </div>
    </SetupFrame>
  );
}

/** Fallback name when Clerk sends none: known clients by host, others by host. */
function appNameFromRedirect(redirectUri: string): string {
  try {
    const host = new URL(redirectUri).hostname.replace(/^www\./, "");
    if (host === "chatgpt.com" || host.endsWith(".openai.com")) return "ChatGPT";
    if (host === "claude.ai" || host.endsWith(".anthropic.com")) return "Claude";
    return host;
  } catch {
    return "This app";
  }
}

const AUTH_LINKS = [
  { href: "https://tryunsora.com/terms", label: "Terms" },
  { href: "https://tryunsora.com/privacy", label: "Privacy" },
  { href: "https://tryunsora.com/docs", label: "Docs" },
];

/** Same shape as app/(auth)/layout.tsx: the form beside Unsora's brand stage. */
function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Link href="https://tryunsora.com" className="inline-flex w-fit rounded-md">
          <UnsoraLogo variant="full" priority className="h-7" />
        </Link>
        <main className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">{children}</div>
        </main>
        <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Unsora</span>
          {AUTH_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="rounded-sm hover:text-foreground">
              {link.label}
            </a>
          ))}
        </footer>
      </div>
      <aside className="hidden p-3 lg:flex">
        <AuthShowcase />
      </aside>
    </div>
  );
}

function Problem({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <UnsoraLogo variant="icon" className="mx-auto size-10" />
        <h1 className="font-display text-2xl font-bold tracking-[-0.03em] text-foreground">
          Can&apos;t connect this app
        </h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Link href="/" className={buttonVariants({ variant: "secondary" })}>
          Open Unsora
        </Link>
      </div>
    </div>
  );
}
