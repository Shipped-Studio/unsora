"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import {
  ArrowsLeftRight,
  ChartBar,
  Coins,
  IdentificationCard,
  PaperPlaneTilt,
  WarningCircle,
} from "@phosphor-icons/react";
import { UnsoraLogo } from "@/components/brand/unsora-logo";
import { ClaudeIcon, CursorIcon, OpenAIIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { FLOW_PARAMS } from "./flow-params";

type Decision = "true" | "false";

interface Permission {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  /** Live context under the row: what's actually at stake right now. */
  detail?: string;
}

/**
 * The last screen of the connector flow: what the MCP client may do, then
 * Allow / Deny, which post to Clerk and send the user back to the client.
 * Clerk's own scope descriptions ("Your private metadata…") describe Clerk
 * user fields, not Unsora, so the rows are written from the MCP tool surface.
 */
export function ConsentForm({
  clientId,
  appName,
  logoUrl,
  returnHost,
  email,
  scopes,
  credits,
  accountCount,
  plansUrl,
}: {
  clientId: string;
  appName: string;
  logoUrl: string;
  returnHost: string;
  email: string | null;
  scopes: string[];
  credits: number | null;
  accountCount: number | null;
  /**
   * No plan yet: warn that posting won't work, and open this page (the
   * plans) in a new tab on Allow, as Clerk sends this tab back to the app.
   */
  plansUrl: string | null;
}) {
  const clerk = useClerk();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState<Decision | null>(null);

  const actsForYou: Permission[] = [
    {
      icon: PaperPlaneTilt,
      text: "Create, schedule and publish posts to your connected accounts",
      detail:
        accountCount === null
          ? undefined
          : accountCount === 0
            ? "No accounts connected yet"
            : `${accountCount} account${accountCount === 1 ? "" : "s"} connected`,
    },
    {
      icon: Coins,
      text: "Generate images, video, music and voiceovers using your credits",
      detail: credits === null ? undefined : `You have ${credits.toLocaleString()} credits`,
    },
  ];
  const canSee: Permission[] = [
    { icon: ChartBar, text: "Your posts, uploads, generations and credit balance" },
    ...(scopes.includes("email") || scopes.includes("profile")
      ? [{ icon: IdentificationCard, text: "Your name and email address" }]
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
        const decision = (submitter?.value as Decision) ?? "true";
        // Still inside the click, so the browser allows the new tab.
        if (decision === "true" && plansUrl) window.open(plansUrl, "_blank");
        setSubmitting(decision);
      }}
    >
      <div className="flex items-center justify-center gap-3">
        <AppLogo name={appName} logoUrl={logoUrl} />
        <span className="flex size-8 items-center justify-center rounded-full border bg-card text-muted-foreground">
          <ArrowsLeftRight className="size-4" />
        </span>
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
          <UnsoraLogo variant="icon" className="size-7" />
        </div>
      </div>

      <div className="space-y-3 text-center">
        <h1 className="font-display text-2xl font-bold tracking-[-0.03em] text-foreground">
          Connect {appName} to Unsora
        </h1>
        {email ? (
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>
              Signed in as <span className="font-medium text-foreground">{email}</span>
            </span>
            <button
              type="button"
              className="rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              // proxy.ts sends the signed-out visitor to /sign-in and back here.
              onClick={() => clerk.signOut({ redirectUrl: window.location.href })}
            >
              Switch account
            </button>
          </p>
        ) : null}
      </div>

      {plansUrl ? (
        <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3.5 text-sm">
          <WarningCircle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              {credits ? "Posting needs a plan" : "You don't have a plan or credits yet"}
            </p>
            <p className="text-muted-foreground">
              {credits
                ? `${appName} can create with your ${credits.toLocaleString()} credits, but can't post until you start a free trial or pick a plan.`
                : `${appName} won't be able to create or post anything until you start a free trial or pick a plan.`}{" "}
              We&apos;ll show you the plans when you click Allow.
            </p>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <PermissionGroup title={`${appName} can act for you`} items={actsForYou} highlight />
        <PermissionGroup title={`${appName} can see`} items={canSee} />
      </div>

      {/* Forward the original OAuth parameters, except fields set by this form
          and the connector flow's own navigation state. */}
      {Array.from(searchParams.entries())
        .filter(
          ([key]) =>
            key !== "consented" &&
            key !== "organization_id" &&
            !(FLOW_PARAMS as readonly string[]).includes(key),
        )
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
        You&apos;ll go back to {returnHost}. You can disconnect {appName} any time from its
        settings.
      </p>
    </form>
  );
}

function PermissionGroup({
  title,
  items,
  highlight,
}: {
  title: string;
  items: Permission[];
  /** Rows that act on the user's behalf: publishing and spending credits. */
  highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-xl", highlight ? "border bg-card" : "bg-muted")}>
      <p className="px-4 pt-3.5 pb-1.5 text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="text-sm">
        {items.map((item) => (
          <li key={item.text} className="flex gap-3 px-4 py-2.5 last:pb-3.5">
            <span
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md",
                highlight ? "bg-warning/15 text-warning" : "bg-card text-muted-foreground",
              )}
            >
              <item.icon className="size-3.5" />
            </span>
            <span className="min-w-0 space-y-0.5">
              <span className="block text-foreground">{item.text}</span>
              {item.detail ? (
                <span className="block text-xs text-muted-foreground">{item.detail}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Well-known MCP clients get their real mark even when Clerk has no logo URL. */
function knownAppMark(name: string) {
  const n = name.toLowerCase();
  if (n.includes("chatgpt") || n.includes("openai")) return <OpenAIIcon className="size-8" />;
  if (n.includes("claude")) return <ClaudeIcon className="size-8" />;
  if (n.includes("cursor")) return <CursorIcon className="size-8" />;
  return null;
}

export function AppLogo({ name, logoUrl }: { name: string; logoUrl: string }) {
  const [broken, setBroken] = useState(false);
  const known = knownAppMark(name);
  return (
    <div className="flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-muted text-foreground">
      {known ? (
        known
      ) : logoUrl && !broken ? (
        // Arbitrary client-registered host, so next/image's remote allowlist can't cover it.
        <img
          src={logoUrl}
          alt=""
          className="size-8 object-contain"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="font-display text-xl font-bold">{name.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}
