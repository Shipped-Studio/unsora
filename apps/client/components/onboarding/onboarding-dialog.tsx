"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  Check,
  CheckCircle,
  Clock,
  Sparkle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { ConnectAgentTabs } from "@/components/agents/connect-agent-tabs";
import { AccountAvatar, accountLabel } from "@/components/scheduler/account-avatar";
import { ConnectGrid } from "@/components/scheduler/accounts-view";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { useUpdatePreferences } from "@/hooks/use-schedule";
import { useUserUsage } from "@/hooks/use-user-usage";
import { TUTORIAL_VIDEO_URL } from "@/lib/navigation";
import { getBrowserTimezone } from "@/lib/timezone";
import { cn } from "@/lib/utils";

/**
 * First-run setup, shown over the app as a modal: connect channels, connect
 * an AI agent, watch the tutorial. Opened by `?onboarding=<step>` (sign-up
 * lands on /onboarding, which redirects here); the step lives in the URL so
 * it survives the OAuth round trip when connecting a channel.
 */
const STEPS = [
  { id: "channels", label: "Connect channels" },
  { id: "agents", label: "Connect agents" },
  { id: "tutorial", label: "Watch tutorial" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export const ONBOARDING_PARAM = "onboarding";

/** A YouTube watch / share / embed URL as an embed URL, else null. */
function youTubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname === "youtu.be") id = u.pathname.slice(1);
    else if (u.hostname.endsWith("youtube.com") || u.hostname.endsWith("youtube-nocookie.com")) {
      id = u.searchParams.get("v") ?? u.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1] ?? null;
    }
    return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
  } catch {
    return null;
  }
}

function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1.5 text-center">
      <DialogTitle className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center justify-center gap-2 sm:gap-3" aria-label="Setup progress">
      {STEPS.map((step, index) => (
        <li key={step.id} className="flex items-center gap-2 sm:gap-3">
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums",
              index < current && "border-primary bg-primary text-primary-foreground",
              index === current && "border-foreground bg-foreground font-medium text-background",
              index > current && "text-muted-foreground",
            )}
            aria-current={index === current ? "step" : undefined}
          >
            {index < current ? <Check className="size-3.5" weight="bold" /> : index + 1}
          </span>
          <span
            className={cn(
              "hidden text-sm sm:inline",
              index === current ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {step.label}
          </span>
          {index < STEPS.length - 1 ? <span className="h-px w-6 bg-border sm:w-12" /> : null}
        </li>
      ))}
    </ol>
  );
}

function ChannelsStep() {
  const { data: accounts } = useConnectedAccounts();
  return (
    <div className="space-y-6">
      <StepHeading
        title="Connect your channels"
        description="Connect the social accounts you want to schedule posts to. You can add more any time from Accounts."
      />
      {accounts?.length ? (
        <ul className="flex flex-wrap justify-center gap-2">
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
      <ConnectGrid returnTo={`/?${ONBOARDING_PARAM}=channels`} />
    </div>
  );
}

function AgentsStep() {
  return (
    <div className="space-y-6">
      <StepHeading
        title="Connect your AI agent"
        description="Pick the agent you use and let it create and schedule posts for you."
      />
      <ConnectAgentTabs />
    </div>
  );
}

const NEXT_UP = [
  {
    href: "/scheduler/new",
    icon: CalendarPlus,
    title: "Create your first post",
    body: "Write once and schedule it to every connected account.",
  },
  {
    href: "/image-generator",
    icon: Sparkle,
    title: "Make something to post",
    body: "Generate images, video, music and voiceovers.",
  },
  {
    href: "/scheduler/queue",
    icon: Clock,
    title: "Set your posting times",
    body: "Add to queue then picks the next open time for you.",
  },
];

function TutorialStep({ onNavigate }: { onNavigate: (href: string) => void }) {
  const embed = TUTORIAL_VIDEO_URL ? youTubeEmbed(TUTORIAL_VIDEO_URL) : null;
  return (
    <div className="space-y-6">
      <StepHeading
        title={embed ? "Learn how to use Unsora" : "You're all set"}
        description={
          embed
            ? "Watch this short video to get the most out of Unsora."
            : "Here are a few good places to start."
        }
      />
      {embed ? (
        <div className="mx-auto aspect-video w-full max-w-3xl overflow-hidden rounded-xl bg-media">
          <iframe
            src={embed}
            title="Unsora tutorial"
            className="size-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-3">
          {NEXT_UP.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(item.href);
              }}
              className="space-y-2 rounded-xl bg-muted p-4 transition-colors hover:bg-accent"
            >
              <item.icon className="size-5" />
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.body}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function OnboardingDialog() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const { usage } = useUserUsage();
  const { data: accounts } = useConnectedAccounts();
  const savePreferences = useUpdatePreferences();
  const [finishing, setFinishing] = useState(false);

  const param = searchParams.get(ONBOARDING_PARAM);
  const open = param !== null;
  const step = Math.max(0, STEPS.findIndex((s) => s.id === (param as StepId)));

  const go = (index: number) =>
    router.replace(`${pathname}?${ONBOARDING_PARAM}=${STEPS[index].id}`, { scroll: false });

  /** Close the modal for good: remember it's done and keep the browser's timezone. */
  const finish = async (navigateTo?: string) => {
    setFinishing(true);
    await Promise.allSettled([
      user?.update({
        unsafeMetadata: { ...user.unsafeMetadata, onboardedAt: new Date().toISOString() },
      }),
      usage && !usage.preferences?.timezone
        ? savePreferences.mutateAsync({ timezone: getBrowserTimezone() })
        : Promise.resolve(),
    ]);
    setFinishing(false);
    router.replace(navigateTo ?? pathname, { scroll: false });
  };

  const hasChannels = (accounts?.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && void finish()}>
      <DialogContent className="flex max-h-[92svh] flex-col gap-0 p-0 sm:max-w-5xl">
        <div className="border-b px-6 py-5 pr-14">
          <Stepper current={step} />
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-8 sm:px-10">
          {step === 0 ? <ChannelsStep /> : null}
          {step === 1 ? <AgentsStep /> : null}
          {step === 2 ? <TutorialStep onNavigate={(href) => void finish(href)} /> : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
          {step > 0 ? (
            <Button variant="outline" onClick={() => go(step - 1)}>
              <ArrowLeft />
              Back
            </Button>
          ) : (
            <span />
          )}
          {step === 0 ? (
            <Button onClick={() => go(1)}>
              {hasChannels ? "Continue" : "Continue without channels"}
              <ArrowRight />
            </Button>
          ) : step === 1 ? (
            <Button onClick={() => go(2)}>
              Continue
              <ArrowRight />
            </Button>
          ) : (
            <Button onClick={() => void finish()} disabled={finishing}>
              {finishing ? <Spinner /> : <CheckCircle />}
              Get started
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
