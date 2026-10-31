"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useClerk, useOAuthConsent, useUser } from "@clerk/nextjs";
import {
  ArrowSquareOut,
  CheckCircle,
  Coins,
  Eye,
  IdentificationCard,
  Lightning,
  PaperPlaneTilt,
  Plugs,
} from "@phosphor-icons/react";
import { UnsoraLogo } from "@/components/brand/unsora-logo";
import { AccountAvatar } from "@/components/scheduler/account-avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { useUserUsage } from "@/hooks/use-user-usage";
import { cn } from "@/lib/utils";
import { AppMark } from "@/components/onboarding/app-mark";
import { hasPaidPlan } from "@/components/onboarding/setup";

type Consent = NonNullable<ReturnType<typeof useOAuthConsent>["data"]>;
type Decision = "true" | "false";

/** How long the "you're all set" screen shows before Clerk sends them back. */
const HANDOFF_MS = 1800;

/**
 * What a connected MCP client can actually do with the token. Clerk's own scope
 * descriptions ("Your private metadata…") describe Clerk user fields, not
 * Unsora, so the list is written from the MCP tool surface instead. The first
 * group acts on the user's behalf, so it is set apart from what it can only see.
 */
const ACTS = [
  { icon: PaperPlaneTilt, text: "Post to your connected accounts" },
  { icon: Coins, text: "Use your credits to clip and create" },
];
const SEES = [{ icon: Eye, text: "Your posts, files and credit balance" }];

export function ConsentForm({
  appName,
  appIcon,
  consent,
}: {
  appName: string;
  appIcon?: React.ComponentType<{ className?: string }>;
  consent: Consent;
}) {
  const clerk = useClerk();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState<Decision | null>(null);
  const [handingOff, setHandingOff] = useState(false);
  const allowRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);

  const { usage } = useUserUsage();
  const { data: accounts } = useConnectedAccounts();
  const isPaid = hasPaidPlan(usage);

  const scopes = searchParams.get("scope")?.split(" ") ?? [];
  const sees = [
    ...SEES,
    ...(scopes.includes("email") || scopes.includes("profile")
      ? [{ icon: IdentificationCard, text: "Your name and email" }]
      : []),
  ];
  const returnHost = consent.redirectDomain || hostname(searchParams.get("redirect_uri") ?? "");
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.username;
  const planName = usage?.user.plan && isPaid ? usage.user.plan : null;
  const trialing = usage?.user.status === "trialing";

  return (
    <section className="mx-auto w-full max-w-lg">
      <form
        ref={formRef}
        method="POST"
        action={clerk.oauthApplication.buildConsentActionUrl({
          clientId: searchParams.get("client_id") ?? "",
        })}
        className={cn("space-y-6", handingOff && "hidden")}
        onSubmit={(event) => {
          // A second click would post a consent Clerk has already used.
          if (submitting && !confirmed.current) return event.preventDefault();
          if (confirmed.current) return;
          const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          const decision = (submitter?.value as Decision) ?? "true";
          setSubmitting(decision);
          if (decision === "false") return;
          // Show the hand-off screen first, then post the consent for real.
          event.preventDefault();
          setHandingOff(true);
          window.setTimeout(() => {
            confirmed.current = true;
            formRef.current?.requestSubmit(allowRef.current ?? undefined);
          }, HANDOFF_MS);
        }}
      >
        <div className="space-y-5 text-center">
          <div className="flex items-center justify-center gap-3">
            <AppMark name={appName} logoUrl={consent.oauthApplicationLogoUrl} icon={appIcon} />
            <span aria-hidden className="flex items-center gap-1">
              <span className="h-px w-5 bg-foreground/30" />
              <span className="flex size-7 items-center justify-center rounded-full bg-brand text-brand-foreground ring-1 ring-foreground/80">
                <Plugs className="size-3.5" weight="bold" />
              </span>
              <span className="h-px w-5 bg-foreground/30" />
            </span>
            <span className="flex size-14 items-center justify-center rounded-2xl bg-card ring-1 ring-border">
              <UnsoraLogo variant="icon" priority className="size-8" />
            </span>
          </div>
          <div>
            <h1
              tabIndex={-1}
              className="font-display text-3xl leading-[1.1] font-bold tracking-[-0.035em] text-balance text-foreground outline-none"
            >
              Allow {appName} to use Unsora
            </h1>
          </div>
        </div>

        {/* Signed-in account, with the way out right next to it. */}
        <div className="flex items-center gap-3 rounded-2xl bg-card p-3 pr-4 ring-1 ring-border">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />
          ) : (
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-display text-sm font-bold uppercase"
            >
              {email?.charAt(0) ?? "?"}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Signed in as</p>
            <p className="truncate text-sm font-medium">{email ?? "your Unsora account"}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            // Signed out, the page sends them to /sign-in and back here.
            onClick={() => clerk.signOut({ redirectUrl: window.location.href })}
          >
            Switch account
          </Button>
        </div>

        {/* What the app will be working with. */}
        <dl className="grid grid-cols-3 divide-x overflow-hidden rounded-2xl bg-card ring-1 ring-border">
          <SummaryCell label="Channels">
            {accounts?.length ? (
              <span className="flex items-center gap-2">
                <span className="flex -space-x-1.5">
                  {accounts.slice(0, 3).map((account) => (
                    <AccountAvatar
                      key={account.id}
                      account={account}
                      size="sm"
                      className="ring-2 ring-card"
                    />
                  ))}
                </span>
                <span className="tabular-nums">{accounts.length}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">None yet</span>
            )}
          </SummaryCell>
          <SummaryCell label="Plan">
            {planName ? (
              <span className="truncate">
                <span className="capitalize">{planName}</span>
                {trialing ? <span className="text-muted-foreground"> trial</span> : null}
              </span>
            ) : (
              <span className="text-muted-foreground">No plan</span>
            )}
          </SummaryCell>
          <SummaryCell label="Credits">
            <span className="tabular-nums">{usage ? usage.credits.toLocaleString() : "—"}</span>
          </SummaryCell>
        </dl>

        <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
          <PermissionGroup
            title="Can act for you"
            icon={<Lightning className="size-3.5" weight="fill" />}
            emphasis
            items={ACTS}
          />
          <PermissionGroup
            title="Can see"
            icon={<Eye className="size-3.5" />}
            items={sees}
          />
        </div>

        {/* Forward the original OAuth parameters, except fields set by this form. */}
        {Array.from(searchParams.entries())
          .filter(([key]) => key !== "consented" && key !== "organization_id")
          .map(([key, value], index) => (
            <input key={`${key}:${index}`} type="hidden" name={key} value={value} />
          ))}

        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <Button
              type="submit"
              name="consented"
              value="false"
              variant="secondary"
              size="lg"
              aria-busy={submitting === "false"}
              // Not `disabled`: a disabled submitter drops its name/value from the post.
              className={cn(
                submitting && "pointer-events-none",
                submitting === "true" && "opacity-50",
              )}
            >
              {submitting === "false" ? <Spinner /> : null}
              Deny
            </Button>
            <Button
              ref={allowRef}
              type="submit"
              name="consented"
              value="true"
              size="lg"
              aria-busy={submitting === "true"}
              className={cn(
                submitting && "pointer-events-none",
                submitting === "false" && "opacity-50",
              )}
            >
              Allow
            </Button>
          </div>
          <p className="text-center text-xs text-pretty text-muted-foreground">
            You can disconnect {appName} anytime.
          </p>
        </div>
      </form>

      {handingOff ? (
        <Handoff
          appName={appName}
          returnHost={returnHost}
          onGoNow={() => {
            confirmed.current = true;
            formRef.current?.requestSubmit(allowRef.current ?? undefined);
          }}
        />
      ) : null}
    </section>
  );
}

function SummaryCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5 px-4 py-3.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-h-6 items-center text-sm font-medium">{children}</dd>
    </div>
  );
}

function PermissionGroup({
  title,
  icon,
  items,
  emphasis,
}: {
  title: string;
  icon: React.ReactNode;
  items: { icon: React.ComponentType<{ className?: string }>; text: string }[];
  emphasis?: boolean;
}) {
  return (
    <div className={cn("px-4 py-4", emphasis ? "bg-warning-subtle" : "border-t")}>
      <p
        className={cn(
          "mb-3 flex items-center gap-1.5 text-xs font-medium",
          emphasis ? "text-warning" : "text-muted-foreground",
        )}
      >
        {icon}
        {title}
      </p>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.text} className="flex items-start gap-3 text-sm">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                emphasis ? "bg-card ring-1 ring-warning/25" : "bg-muted",
              )}
            >
              <item.icon className="size-4" />
            </span>
            <span className="pt-1.5 text-pretty">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The last screen: shown while the consent posts and Clerk redirects. */
function Handoff({
  appName,
  returnHost,
  onGoNow,
}: {
  appName: string;
  returnHost: string;
  onGoNow: () => void;
}) {
  return (
    <div
      role="status"
      className="animate-in space-y-8 text-center duration-500 fade-in zoom-in-95"
    >
      <div className="relative mx-auto flex size-20 items-center justify-center">
        <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-brand/40 [animation-iteration-count:2]" />
        <span className="relative flex size-20 items-center justify-center rounded-full bg-brand text-brand-foreground ring-1 ring-foreground/80">
          <CheckCircle className="size-10" weight="fill" />
        </span>
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-3xl leading-[1.1] font-bold tracking-[-0.035em] text-foreground">
          You&apos;re all set
        </h1>
        <p className="flex items-center justify-center gap-2 text-muted-foreground">
          <Spinner className="size-4" />
          Opening {returnHost}
        </p>
      </div>

      <Button variant="outline" size="lg" onClick={onGoNow}>
        Go to {appName} now
        <ArrowSquareOut data-icon="inline-end" />
      </Button>
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
