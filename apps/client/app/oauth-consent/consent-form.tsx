"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useClerk, useOAuthConsent, useUser } from "@clerk/nextjs";
import { UnsoraLogo } from "@/components/brand/unsora-logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * What a connected MCP client can actually do with the token. Clerk's own scope
 * descriptions ("Your private metadata…") describe Clerk user fields, not
 * Unsora, so the list is written from the MCP tool surface instead.
 */
const ACCESS = [
  "Create, schedule and publish posts to your connected accounts",
  "Generate images, video, music and voiceovers using your credits",
  "See your posts, uploads, generations and credit balance",
];

type Decision = "true" | "false";

export function ConsentForm() {
  const clerk = useClerk();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState<Decision | null>(null);

  const clientId = searchParams.get("client_id") ?? "";
  const redirectUri = searchParams.get("redirect_uri") ?? "";
  const scope = searchParams.get("scope") ?? undefined;
  const scopes = scope?.split(" ") ?? [];

  const { data, error } = useOAuthConsent({ oauthClientId: clientId, scope, redirectUri });

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
  if (!data) return <Spinner className="mx-auto size-6 text-muted-foreground" />;

  const appName = data.oauthApplicationName || "This app";
  const returnHost = data.redirectDomain || hostname(redirectUri);
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.username;
  const access = [
    ...ACCESS,
    ...(scopes.includes("email") || scopes.includes("profile")
      ? ["See your name and email address"]
      : []),
  ];

  return (
    <form
      method="POST"
      action={clerk.oauthApplication.buildConsentActionUrl({ clientId })}
      className="space-y-6"
      onSubmit={(event) => {
        // A second click would post a consent Clerk has already used.
        if (submitting) return event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        setSubmitting((submitter?.value as Decision) ?? "true");
      }}
    >
      <div className="flex items-center justify-center gap-3">
        <AppLogo name={appName} logoUrl={data.oauthApplicationLogoUrl} />
        <span aria-hidden className="tracking-[0.2em] text-muted-foreground">
          ···
        </span>
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
          <UnsoraLogo variant="icon" className="size-7" />
        </div>
      </div>

      <div className="space-y-2 text-center">
        <h1 className="font-display text-2xl font-bold tracking-[-0.03em] text-foreground">
          Connect {appName} to Unsora
        </h1>
        <p className="text-sm text-muted-foreground">
          {appName} is asking to use your Unsora account
          {email ? (
            <>
              {" "}
              <span className="font-medium text-foreground">{email}</span>
            </>
          ) : null}
          .
        </p>
      </div>

      <div className="rounded-xl bg-muted">
        <p className="px-4 pt-3.5 pb-2 text-xs font-medium text-muted-foreground">
          {appName} will be able to
        </p>
        <ul className="divide-y divide-card text-sm">
          {access.map((item) => (
            <li key={item} className="px-4 py-3">
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Forward the original OAuth parameters, except fields set by this form. */}
      {Array.from(searchParams.entries())
        .filter(([key]) => key !== "consented" && key !== "organization_id")
        .map(([key, value], index) => (
          <input key={`${key}:${index}`} type="hidden" name={key} value={value} />
        ))}

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="submit"
          name="consented"
          value="false"
          variant="secondary"
          size="lg"
          aria-busy={submitting === "false"}
          // Not `disabled`: a disabled submitter drops its name/value from the post.
          className={cn(submitting && "pointer-events-none", submitting === "true" && "opacity-50")}
        >
          {submitting === "false" ? <Spinner /> : null}
          Deny
        </Button>
        <Button
          type="submit"
          name="consented"
          value="true"
          size="lg"
          aria-busy={submitting === "true"}
          className={cn(submitting && "pointer-events-none", submitting === "false" && "opacity-50")}
        >
          {submitting === "true" ? <Spinner /> : null}
          Allow
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        You&apos;ll go back to {returnHost} after you choose. Only allow apps you trust. You can
        disconnect {appName} at any time from its connector settings.
        {email ? (
          <>
            {" "}
            Not you?{" "}
            <button
              type="button"
              className="rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              // proxy.ts sends the signed-out visitor to /sign-in and back here.
              onClick={() => clerk.signOut({ redirectUrl: window.location.href })}
            >
              Switch account
            </button>
          </>
        ) : null}
      </p>
    </form>
  );
}

function AppLogo({ name, logoUrl }: { name: string; logoUrl: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-muted">
      {logoUrl && !broken ? (
        // Arbitrary client-registered host, so next/image's remote allowlist can't cover it.
        <img
          src={logoUrl}
          alt=""
          className="size-8 object-contain"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="font-display text-xl font-bold text-foreground">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function ConsentProblem({ message }: { message: string }) {
  return (
    <div className="space-y-4 text-center">
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
