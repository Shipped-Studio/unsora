"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, Check } from "@phosphor-icons/react";
import { toast } from "sonner";
import { UnsoraLogo } from "@/components/brand/unsora-logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { CodeBlock } from "@/components/agents/connect-agent-tabs";
import { AccountAvatar, accountLabel } from "@/components/scheduler/account-avatar";
import { ConnectGrid } from "@/components/scheduler/accounts-view";
import { TimezoneCombobox } from "@/components/scheduler/timezone-combobox";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import {
  usePostingSlots,
  useSavePostingSlots,
  useUpdatePreferences,
} from "@/hooks/use-schedule";
import { useUserUsage } from "@/hooks/use-user-usage";
import { MCP_URL } from "@/lib/navigation";
import { getBrowserTimezone } from "@/lib/timezone";
import { cn } from "@/lib/utils";

const STEPS = ["Accounts", "Schedule", "Agent"] as const;

/** Weekdays at 9:00, 13:00 and 17:00. A starting point people can edit later. */
const SUGGESTED_SLOTS = [1, 2, 3, 4, 5].flatMap((weekday) =>
  ["09:00", "13:00", "17:00"].map((time) => ({ weekday, time })),
);

function AccountsStep() {
  const { data: accounts } = useConnectedAccounts();
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Connect where you post</h1>
        <p className="text-sm text-muted-foreground">
          Add the accounts you want to schedule to. You can add more any time from Accounts.
        </p>
      </div>
      {accounts?.length ? (
        <ul className="flex flex-wrap gap-2">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center gap-2 rounded-xl bg-muted py-1.5 pr-3 pl-1.5 text-sm"
            >
              <AccountAvatar account={account} size="sm" />
              {accountLabel(account)}
              <Check className="size-3.5 text-success" />
            </li>
          ))}
        </ul>
      ) : null}
      <ConnectGrid compact returnTo="/onboarding" />
    </div>
  );
}

function ScheduleStep({
  zone,
  onZone,
  useSuggested,
  onUseSuggested,
  hasSlots,
}: {
  zone: string;
  onZone: (zone: string) => void;
  useSuggested: boolean;
  onUseSuggested: (value: boolean) => void;
  hasSlots: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">When do you post?</h1>
        <p className="text-sm text-muted-foreground">
          Times on your calendar use this timezone. Posting times let Add to queue and your agent
          pick the next open time for you.
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Timezone</p>
        <TimezoneCombobox value={zone} onChange={onZone} className="w-full sm:w-96" />
      </div>
      {!hasSlots ? (
        <label className="flex items-start gap-3 rounded-xl bg-muted p-4">
          <Checkbox
            checked={useSuggested}
            onCheckedChange={(checked) => onUseSuggested(checked === true)}
            className="mt-0.5"
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">Start with weekday posting times</span>
            <span className="block text-sm text-muted-foreground">
              Monday to Friday at 9:00, 13:00 and 17:00. Change them on the Queue page.
            </span>
          </span>
        </label>
      ) : (
        <p className="text-sm text-muted-foreground">
          You already have posting times. Edit them on the Queue page.
        </p>
      )}
    </div>
  );
}

function AgentStep() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Let your agent make and schedule posts</h1>
        <p className="text-sm text-muted-foreground">
          Add Unsora to Claude, ChatGPT or Cursor. Your agent can generate images and video, then
          schedule them to your accounts.
        </p>
      </div>
      <ol className="space-y-4 text-sm">
        <li className="space-y-2">
          <p>
            <span className="font-medium">Claude or ChatGPT:</span>{" "}
            <span className="text-muted-foreground">
              open Settings, then Connectors, add a custom connector with this URL, and sign in to
              Unsora when asked.
            </span>
          </p>
          <CodeBlock label="MCP server URL" code={MCP_URL} />
        </li>
        <li className="text-muted-foreground">
          <span className="font-medium text-foreground">Claude Code or Cursor:</span> these use an
          API key. The{" "}
          <Link href="/connect-agent" className="text-foreground underline underline-offset-4">
            Agents page
          </Link>{" "}
          has the exact setup for each.
        </li>
      </ol>
      <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
        Try asking: &ldquo;Make three vertical videos about our spring sale and add them to my
        Unsora queue for next week.&rdquo;
      </p>
    </div>
  );
}

function Onboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { usage } = useUserUsage();
  const slots = usePostingSlots();
  const savePreferences = useUpdatePreferences();
  const saveSlots = useSavePostingSlots();

  const step = Math.min(Math.max(Number(searchParams.get("step")) || 0, 0), STEPS.length - 1);
  const [zone, setZone] = useState<string | null>(null);
  const [useSuggested, setUseSuggested] = useState(true);
  const [finishing, setFinishing] = useState(false);

  const activeZone = zone ?? usage?.preferences?.timezone ?? getBrowserTimezone();
  const hasSlots = (slots.data?.slots.length ?? 0) > 0;

  const go = (next: number) => router.replace(`/onboarding?step=${next}`, { scroll: false });

  const saveSchedule = async () => {
    try {
      await savePreferences.mutateAsync({ timezone: activeZone });
      if (useSuggested && !hasSlots) {
        await saveSlots.mutateAsync({ slots: SUGGESTED_SLOTS, timezone: activeZone });
      }
      go(2);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const finish = async () => {
    setFinishing(true);
    try {
      await user?.update({
        unsafeMetadata: { ...user.unsafeMetadata, onboardedAt: new Date().toISOString() },
      });
    } catch {
      // Not fatal: onboarding is only shown after sign-up.
    }
    router.push("/");
  };

  const saving = savePreferences.isPending || saveSlots.isPending;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-16 items-center justify-between px-6 sm:px-10">
        <UnsoraLogo variant="full" priority className="h-7" />
        <button
          type="button"
          onClick={finish}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Skip setup
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8 sm:py-14">
        <ol className="mb-10 flex items-center gap-2" aria-label="Setup progress">
          {STEPS.map((label, index) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums",
                  index < step && "border-primary bg-primary text-primary-foreground",
                  index === step && "border-foreground font-medium",
                  index > step && "text-muted-foreground",
                )}
                aria-current={index === step ? "step" : undefined}
              >
                {index < step ? <Check className="size-3" weight="bold" /> : index + 1}
              </span>
              <span className={cn("text-sm", index === step ? "text-foreground" : "text-muted-foreground")}>
                {label}
              </span>
              {index < STEPS.length - 1 ? <span className="h-px flex-1 bg-border" /> : null}
            </li>
          ))}
        </ol>

        <div className="flex-1">
          {step === 0 ? <AccountsStep /> : null}
          {step === 1 ? (
            <ScheduleStep
              zone={activeZone}
              onZone={setZone}
              useSuggested={useSuggested}
              onUseSuggested={setUseSuggested}
              hasSlots={hasSlots}
            />
          ) : null}
          {step === 2 ? <AgentStep /> : null}
        </div>

        <div className="mt-10 flex items-center justify-between border-t pt-6">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => go(step - 1)}>
              <ArrowLeft />
              Back
            </Button>
          ) : (
            <span />
          )}
          {step === 0 ? (
            <Button onClick={() => go(1)}>Continue</Button>
          ) : step === 1 ? (
            <Button onClick={saveSchedule} disabled={saving}>
              {saving ? <Spinner /> : null}
              Continue
            </Button>
          ) : (
            <Button onClick={finish} disabled={finishing}>
              {finishing ? <Spinner /> : null}
              Go to Unsora
            </Button>
          )}
        </div>
        {step === 2 ? (
          <p className="mt-3 text-right text-xs text-muted-foreground">
            <Link href="/connect-agent" className={buttonVariants({ variant: "link", size: "xs", className: "h-auto p-0 text-muted-foreground" })}>
              Open the Agents page instead
            </Link>
          </p>
        ) : null}
      </main>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <Onboarding />
    </Suspense>
  );
}
