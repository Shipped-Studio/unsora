"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useOAuthConsent, useUser } from "@clerk/nextjs";
import { ArrowRight, Plugs } from "@phosphor-icons/react";
import { UnsoraLogo } from "@/components/brand/unsora-logo";
import { AppMark } from "@/components/onboarding/app-mark";
import {
  CONNECT_PARAM,
  connectorApp,
  connectorAppKey,
} from "@/components/onboarding/connector-app";
import { needsOnboarding } from "@/components/onboarding/setup";
import { SetupFrame } from "@/components/onboarding/setup-frame";
import { StepHeader } from "@/components/onboarding/setup-steps";
import { buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { useUserUsage } from "@/hooks/use-user-usage";
import { ConsentForm } from "./consent-form";

/**
 * What an MCP connector (ChatGPT, Claude, …) shows between its OAuth request
 * and handing back to it. Signed-out visitors are sent to /sign-in first and
 * come back here. That check happens here, not in proxy.ts: Clerk's dev
 * instances hand the session over in the URL (`__clerk_db_jwt`), which the
 * server can't read on the first request, so it would see a signed-in user
 * as signed out.
 *
 * Existing accounts go straight to Allow. A brand-new account would land
 * back in the chat with no channels and no plan, so nothing would work: it
 * sets up first (/onboarding, which ends by sending them back to connect).
 * Email sign-ups go there from the sign-up form; Google sign-ups arrive here
 * and are stopped by SetUpFirst.
 */
export function ConsentScreen() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    router.replace(`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`);
  }, [isLoaded, isSignedIn, router]);

  const clientId = searchParams.get("client_id") ?? "";
  const redirectUri = searchParams.get("redirect_uri") ?? "";
  const scope = searchParams.get("scope") ?? undefined;
  const { data: consent, error } = useOAuthConsent({
    oauthClientId: clientId,
    scope,
    redirectUri,
  });

  const key = connectorAppKey(redirectUri);
  const known = key === "app" ? null : connectorApp(key);

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
  // ChatGPT's and Claude's own marks, over whatever Clerk has (often nothing,
  // which would show the app's initial).
  const appIcon = known?.icon;

  if (!consent || !user) {
    // The frame right away, so the wait reads as this page loading.
    return (
      <SetupFrame
        steps={[]}
        current={0}
        appName={known?.name ?? null}
        appIcon={appIcon}
        homeHref="https://tryunsora.com"
      >
        <Spinner className="mt-24 size-6 text-muted-foreground" />
        {isSignedIn ? <PrefetchSummary /> : null}
      </SetupFrame>
    );
  }

  // Clerk's name when the OAuth app has one, else a known app, else its host.
  const appName = consent.oauthApplicationName || known?.name || hostname(redirectUri);
  const appLogoUrl = consent.oauthApplicationLogoUrl;

  return (
    <SetupFrame
      steps={[]}
      current={0}
      appName={appName}
      appLogoUrl={appLogoUrl}
      appIcon={appIcon}
      homeHref="https://tryunsora.com"
    >
      <div className="w-full animate-in duration-300 fade-in slide-in-from-bottom-2">
        {needsOnboarding(user) ? (
          <SetUpFirst
            appName={appName}
            appLogoUrl={appLogoUrl}
            appIcon={appIcon}
            connectKey={key}
          />
        ) : (
          <ConsentForm appName={appName} appIcon={appIcon} consent={consent} />
        )}
      </div>
    </SetupFrame>
  );
}

/**
 * Starts ConsentForm's summary requests alongside the consent request rather
 * than after it. Mounted once signed in, so they go out with a session.
 */
function PrefetchSummary() {
  useUserUsage();
  useConnectedAccounts();
  return null;
}

/** A new account: set up Unsora, then connect again from the app. */
function SetUpFirst({
  appName,
  appLogoUrl,
  appIcon,
  connectKey,
}: {
  appName: string;
  appLogoUrl: string | null | undefined;
  appIcon?: React.ComponentType<{ className?: string }>;
  connectKey: string;
}) {
  return (
    <section className="mx-auto w-full max-w-lg space-y-8 text-center">
      <div className="flex items-center justify-center gap-3">
        <AppMark name={appName} logoUrl={appLogoUrl} icon={appIcon} />
        <span aria-hidden className="flex items-center gap-1">
          <span className="h-px w-5 bg-foreground/30" />
          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
            <Plugs className="size-3.5" weight="bold" />
          </span>
          <span className="h-px w-5 bg-foreground/30" />
        </span>
        <span className="flex size-14 items-center justify-center rounded-2xl bg-card ring-1 ring-border">
          <UnsoraLogo variant="icon" priority className="size-8" />
        </span>
      </div>
      <StepHeader
        title="Set up your account first"
        lead={`Your Unsora account is new. Set it up first: pick where to post and start your free trial. Then connect it to ${appName}.`}
      />
      <Link
        href={`/onboarding?${CONNECT_PARAM}=${encodeURIComponent(connectKey)}`}
        className={buttonVariants({ size: "lg" })}
      >
        Set up my account
        <ArrowRight data-icon="inline-end" />
      </Link>
    </section>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "This app";
  }
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
