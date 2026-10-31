"use client";

import Link from "next/link";
import { Check } from "@phosphor-icons/react";
import { UnsoraLogo } from "@/components/brand/unsora-logo";
import { cn } from "@/lib/utils";
import { AppMark } from "./app-mark";
import { STEP_LABELS, type StepId } from "./setup";

type ProgressItem = { id: string; label: string; state: "done" | "current" | "todo" };

/** Account (done: they are signed in by now), then the setup's steps. */
function progressItems(steps: StepId[], current: number): ProgressItem[] {
  return [
    { id: "account", label: "Account", state: "done" },
    ...steps.map((id, i) => ({
      id,
      label: STEP_LABELS[id],
      state: i < current ? ("done" as const) : i === current ? ("current" as const) : ("todo" as const),
    })),
  ];
}

/**
 * The page around the onboarding and the consent screen: the logo, the
 * stepper and, when an app is connecting, which one. The step itself goes in
 * `children`.
 */
export function SetupFrame({
  steps,
  current,
  appName,
  appLogoUrl,
  appIcon,
  homeHref,
  children,
}: {
  steps: StepId[];
  current: number;
  /** The app being connected, shown top right; null in the app's own onboarding. */
  appName: string | null;
  appLogoUrl?: string | null;
  appIcon?: React.ComponentType<{ className?: string }>;
  homeHref: string;
  children: React.ReactNode;
}) {
  const progress = steps.length > 1 ? progressItems(steps, current) : null;
  // Shown below lg, where the stepper is hidden.
  const badge = steps.length > 1 ? `Step ${current + 2} of ${steps.length + 1}` : null;

  return (
    // Fills a `flex min-h-svh flex-col` page.
    <div className="relative isolate flex flex-1 flex-col overflow-clip">
      {/* Soft brand glow behind the header. `overflow-clip`, not hidden, keeps the
          phone step bar sticky. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-72 left-1/2 -z-10 size-160 -translate-x-1/2 rounded-full bg-brand/15 blur-3xl dark:bg-brand/8"
      />
      <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8 sm:py-5">
        <Link href={homeHref} className="inline-flex w-fit shrink-0 rounded-md">
          <UnsoraLogo variant="full" priority className="h-7" />
        </Link>
        {progress ? <Stepper items={progress} /> : null}
        {appName ? (
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-card py-1 pr-3 pl-1 text-xs text-muted-foreground ring-1 ring-border">
            <AppMark name={appName} logoUrl={appLogoUrl} icon={appIcon} size="xs" />
            <span className="hidden lg:inline">Connecting {appName}</span>
            <span className="tabular-nums lg:hidden">{badge ?? `Connecting ${appName}`}</span>
          </span>
        ) : badge ? (
          <span className="rounded-full bg-card px-3 py-1 text-xs text-muted-foreground tabular-nums ring-1 ring-border lg:invisible">
            {badge}
          </span>
        ) : (
          <span />
        )}
      </header>
      <main className="flex flex-1 justify-center px-4 pt-6 pb-16 sm:px-8 sm:pt-12">{children}</main>
    </div>
  );
}

function Stepper({ items }: { items: ProgressItem[] }) {
  return (
    <ol aria-label="Setup progress" className="hidden items-center gap-3 lg:flex">
      {items.map((item, i) => (
        <li
          key={item.id}
          aria-current={item.state === "current" ? "step" : undefined}
          className="flex items-center gap-3"
        >
          <span
            aria-hidden
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums transition-colors",
              item.state === "done" && "bg-foreground text-background",
              item.state === "current" &&
                "bg-brand text-brand-foreground ring-1 ring-foreground/80 ring-offset-2 ring-offset-background",
              item.state === "todo" && "text-muted-foreground ring-1 ring-input",
            )}
          >
            {item.state === "done" ? <Check className="size-3" weight="bold" /> : i + 1}
          </span>
          <span
            className={cn(
              "text-sm whitespace-nowrap",
              item.state === "current" ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {item.label}
            {item.state === "done" ? <span className="sr-only"> (done)</span> : null}
          </span>
          {i < items.length - 1 ? (
            <span
              aria-hidden
              className={cn(
                "h-px w-6 xl:w-8",
                item.state === "done" ? "bg-foreground/60" : "bg-border",
              )}
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
