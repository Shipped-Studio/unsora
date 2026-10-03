"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

const TUTORIAL_EMBED = TUTORIAL_VIDEO_URL ? youTubeEmbed(TUTORIAL_VIDEO_URL) : null;

const STEPS = [
  { id: "channels", label: "Connect channels" },
  { id: "agents", label: "Connect agents" },
  // Without a tutorial video the last step is a short list of places to start.
  { id: "tutorial", label: TUTORIAL_EMBED ? "Watch tutorial" : "Get started" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export const ONBOARDING_PARAM = "onboarding";

/** Content column shared by every step, so the width doesn't change between them. */
const STEP_BODY = "mx-auto w-full max-w-4xl space-y-6";

function StepHeading({
  title,
  description,
  titleRef,
}: {
  title: string;
  description: string;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className="space-y-1.5 text-center">
      {/* Focus lands here when the dialog opens or the step changes, not on a button. */}
      <DialogTitle
        ref={titleRef}
        tabIndex={-1}
        className="text-xl font-semibold tracking-tight outline-none sm:text-2xl"
      >
        {title}
      </DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center justify-center gap-2 sm:gap-3" aria-label="Setup progress">
      {STEPS.map((step, index) => (
        <li
          key={step.id}
          aria-current={index === current ? "step" : undefined}
          className="flex items-center gap-2 sm:gap-3"
        >
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums",
              index < current && "border-primary bg-primary text-primary-foreground",
              index === current && "border-foreground bg-foreground font-medium text-background",
              index > current && "text-muted-foreground",
            )}
            aria-hidden
          >
            {index < current ? <Check className="size-3.5" weight="bold" /> : index + 1}
          </span>
          <span
            className={cn(
              "sr-only text-sm sm:not-sr-only",
              index === current ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {step.label}
            {index < current ? <span className="sr-only"> (done)</span> : null}
          </span>
          {index < STEPS.length - 1 ? (
            <span aria-hidden className="h-px w-6 bg-border sm:w-12" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

type TitleRef = React.RefObject<HTMLHeadingElement | null>;

function ChannelsStep({ titleRef }: { titleRef: TitleRef }) {
  const { data: accounts } = useConnectedAccounts();
  return (
    <div className={STEP_BODY}>
      <StepHeading
        titleRef={titleRef}
        title="Connect your channels"
        description="Connect the social accounts you want to schedule posts to. You can add more any time from Accounts."
      />
      {accounts?.length ? (
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
      <ConnectGrid returnTo={`/?${ONBOARDING_PARAM}=channels`} />
    </div>
  );
}

function AgentsStep({ titleRef }: { titleRef: TitleRef }) {
  return (
    <div className={STEP_BODY}>
      <StepHeading
        titleRef={titleRef}
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
    body: "Add to queue picks the next open time for you.",
  },
];

function TutorialStep({
  titleRef,
  onNavigate,
}: {
  titleRef: TitleRef;
  onNavigate: (href: string) => void;
}) {
  const embed = TUTORIAL_EMBED;
  return (
    <div className={STEP_BODY}>
      <StepHeading
        titleRef={titleRef}
        title={embed ? "Learn how to use Unsora" : "Get started"}
        description={
          embed
            ? "Watch this short video to get the most out of Unsora."
            : "Here are a few good places to start."
        }
      />
      {embed ? (
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-media">
          <iframe
            src={embed}
            title="Unsora tutorial"
            className="size-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {NEXT_UP.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(item.href);
              }}
              className="space-y-2 rounded-xl bg-muted p-4 transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
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

  // Move focus to the new step's title so the next control doesn't light up
  // with a focus ring, and screen readers announce the step.
  const titleRef = useRef<HTMLHeadingElement>(null);
  const lastStep = useRef(step);
  useEffect(() => {
    if (!open || lastStep.current === step) return;
    lastStep.current = step;
    titleRef.current?.focus({ preventScroll: true });
  }, [open, step]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && void finish()}>
      <DialogContent
        initialFocus={() => titleRef.current ?? true}
        className="flex h-[92svh] flex-col gap-0 p-0 sm:top-[8vh] sm:h-auto sm:max-h-[min(760px,84svh)] sm:min-h-[min(520px,84svh)] sm:max-w-5xl sm:translate-y-0"
      >
        <div className="border-b px-6 py-5 pr-14">
          <Stepper current={step} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-8 sm:px-10">
          {step === 0 ? <ChannelsStep titleRef={titleRef} /> : null}
          {step === 1 ? <AgentsStep titleRef={titleRef} /> : null}
          {step === 2 ? (
            <TutorialStep titleRef={titleRef} onNavigate={(href) => void finish(href)} />
          ) : null}
          {/* Fades the bottom edge so it's clear the list keeps going. */}
          <div
            aria-hidden
            className="pointer-events-none sticky bottom-0 mt-2 h-8 bg-linear-to-t from-popover to-transparent"
          />
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
