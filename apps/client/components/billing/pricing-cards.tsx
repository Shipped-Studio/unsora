"use client";

import { ArrowRight, CheckCircle, FilmStrip, FrameCorners, Scissors } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { CreditPack } from "@/hooks/use-credit-packs";
import { useCatalogQuote, type CatalogRequest } from "@/hooks/use-model-catalog";
import type { SubscriptionPlan } from "@/hooks/use-subscription-plans";
import { CLIPPING_CREDITS_PER_MINUTE } from "@/lib/clipping-pricing";
import { cn } from "@/lib/utils";
import { formatUsd, intervalLabel, planAllowanceLabel } from "./format";
import { ModelLogo } from "./model-logo";
import { planCardFeatures } from "./plan-features";

/*
 * The plan and credit-pack cards, shared by onboarding and /billing so both
 * look the same: a panel with the name up top and the price at the bottom,
 * a full-width button under it, then the list. The highlighted card (the
 * popular one) gets a dark panel.
 */

/** Onboarding lime, fixed here: in the app the brand colour is ink. */
const LIME = "#e8ff6b";

/** Grid classes for a row of cards; the cards need room for their lists. */
function cardGridCols(count: number) {
  if (count >= 4) return "md:grid-cols-2 xl:grid-cols-4";
  if (count === 3) return "md:grid-cols-3";
  return "md:grid-cols-2";
}

/**
 * The `<ul>` around the cards. Each card's panel, button and list sit on
 * shared rows (subgrid, see cardItemClass), so a longer description in one
 * panel can't push its button out of line with the others. Row gaps would
 * land inside the cards, so the space between stacked cards is padding.
 */
export function cardGridClass(count: number) {
  return cn("grid gap-x-5 lg:gap-x-6", cardGridCols(count));
}

/** The `<li>` for each card in a cardGridClass grid. */
export function cardItemClass(count: number) {
  return cn(
    "row-span-3 grid grid-rows-subgrid pb-10",
    // No space under a row that's the only one.
    count >= 4 ? "xl:pb-0" : "md:pb-0",
  );
}

export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className={cn("grid gap-5 lg:gap-6", cardGridCols(count))}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-4">
          <Skeleton className="h-60 rounded-3xl" />
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

function Panel({
  dark,
  title,
  subtitle,
  badge,
  badgeTone,
  bottom,
}: {
  dark: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: string;
  /** `lime` gets the dot (Popular); `plain` is an outlined pill (Current plan). */
  badgeTone?: "lime" | "plain";
  bottom: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-3xl p-6 sm:min-h-60 sm:p-7",
        dark ? "bg-[#0c0c0d] text-white ring-1 ring-white/10" : "bg-card ring-1 ring-border",
      )}
    >
      {dark ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(110% 75% at 100% 0%, color-mix(in oklab, ${LIME} 42%, transparent), transparent 62%), radial-gradient(80% 60% at 0% 100%, color-mix(in oklab, ${LIME} 16%, transparent), transparent 70%)`,
          }}
        />
      ) : null}

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-2xl font-semibold tracking-[-0.03em] tabular-nums sm:text-[1.75rem]">
            {title}
          </h3>
          {subtitle ? (
            <div className={cn("mt-1.5 text-sm", dark ? "text-white/70" : "text-muted-foreground")}>
              {subtitle}
            </div>
          ) : null}
        </div>
        {badge ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium tracking-[0.16em] uppercase",
              badgeTone === "plain"
                ? dark
                  ? "text-white ring-1 ring-white/30"
                  : "text-foreground ring-1 ring-border"
                : "bg-white text-[#0c0c0d] ring-1 ring-black/5",
            )}
          >
            {badgeTone === "plain" ? null : (
              <span aria-hidden className="size-1.5 rounded-full ring-1 ring-black/10" style={{ background: LIME }} />
            )}
            {badge}
          </span>
        ) : null}
      </div>

      <div className="relative mt-auto pt-7 sm:pt-10">{bottom}</div>
    </div>
  );
}

function Price({ usd, per, dark }: { usd: number; per?: string | null; dark: boolean }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <span className="font-display text-5xl font-semibold tracking-[-0.045em] tabular-nums">
        {formatUsd(usd)}
      </span>
      {per ? (
        <span className={cn("text-sm", dark ? "text-white/60" : "text-muted-foreground")}>/{per}</span>
      ) : null}
    </p>
  );
}

export interface CardAction {
  label: string;
  onClick: () => void;
  pending?: boolean;
  disabled?: boolean;
}

/** The button under a panel; with no action, a quiet stand-in keeps the rows aligned. */
function CardButton({
  action,
  primary,
  idleLabel,
}: {
  action: CardAction | null;
  primary: boolean;
  idleLabel?: string;
}) {
  if (!action) {
    return (
      <div className="mt-4 flex h-12 items-center justify-center rounded-2xl text-sm text-muted-foreground ring-1 ring-border ring-dashed">
        {idleLabel}
      </div>
    );
  }
  return (
    <Button
      size="lg"
      variant={primary ? "default" : "outline"}
      className="mt-4 h-12 w-full rounded-2xl text-[15px]"
      disabled={action.disabled}
      onClick={action.onClick}
    >
      {action.pending ? <Spinner data-icon="inline-start" /> : null}
      {action.label}
      {action.pending ? null : <ArrowRight data-icon="inline-end" weight="bold" />}
    </Button>
  );
}

function ListLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------------ */

export function PlanCard({
  plan,
  highlight,
  badge,
  badgeTone = "lime",
  trialDays = 0,
  action,
  idleLabel,
  note,
}: {
  plan: SubscriptionPlan;
  /** Dark panel and the primary button. */
  highlight: boolean;
  badge?: string;
  badgeTone?: "lime" | "plain";
  /** Shows the trial pill; 0 when checkout won't start one. */
  trialDays?: number;
  /** Null hides the button (e.g. the plan you're on). */
  action: CardAction | null;
  /** Text in place of the button when there's no action. */
  idleLabel?: string;
  /** Small print under the button. */
  note?: string | null;
}) {
  const per = intervalLabel(plan.interval);
  const allowance = planAllowanceLabel(plan);
  const { lead, items: allItems } = planCardFeatures(plan);
  // The "Post to" row above the plans shows the platforms.
  const items = allItems.filter((f) => !/^Post to /.test(f));
  const list = lead && !allowance ? [lead, ...items] : items;

  // `contents`: the panel, button and list each fill a row of the parent's
  // subgrid (cardItemClass).
  return (
    <div className="contents">
      <Panel
        dark={highlight}
        title={plan.name}
        subtitle={
          allowance || plan.description ? (
            <>
              {allowance ? <p>{allowance}</p> : null}
              {plan.description ? <p className="mt-1">{plan.description}</p> : null}
            </>
          ) : null
        }
        badge={badge}
        badgeTone={badgeTone}
        bottom={
          <>
            {trialDays ? (
              <span
                className={cn(
                  "mb-3 inline-flex rounded-full px-2.5 py-0.5 font-mono text-[10px] tracking-[0.16em] uppercase ring-1",
                  highlight ? "text-white/80 ring-white/25" : "text-muted-foreground ring-border",
                )}
              >
                {/* Non-breaking hyphen keeps "7-day" on one line. */}
                {trialDays}&#8209;day free trial
              </span>
            ) : null}
            <Price usd={plan.priceUsd} per={per} dark={highlight} />
          </>
        }
      />

      <div>
        <CardButton action={action} primary={highlight} idleLabel={idleLabel} />
        {note ? <p className="mt-2 text-center text-xs text-muted-foreground">{note}</p> : null}
      </div>

      <div className="mt-6 px-1 md:mt-7">
        {list.length ? (
          <>
            <ListLabel>What&apos;s included</ListLabel>
            <ul className="mt-4 space-y-3 text-[15px]">
              {list.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <CheckCircle
                    className={cn(
                      "mt-0.5 size-4.5 shrink-0",
                      highlight ? "text-foreground" : "text-muted-foreground/60",
                    )}
                    weight={highlight ? "fill" : "regular"}
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * What a pack can buy, after clipping. These are priced live, the same way the
 * generators are, so the counts follow any change at /admin/pricing or from the
 * provider. Each request pins the settings its label names; the rest are the
 * model's defaults.
 */
const LIVE_FEATURES: { label: string; icon: React.ReactNode; request: CatalogRequest }[] = [
  {
    label: "Seedance 2.5 videos (5s)",
    icon: <ModelLogo src="/models/bytedance.svg" />,
    request: { model: "seedance-2.5", mode: "omni", inputs: { duration: 5, resolution: "720p" } },
  },
  {
    // Flare, the fast tier. Sunburst costs the same at these settings.
    label: "GPT Image 2.5 images",
    icon: <ModelLogo src="/models/openai.svg" mono />,
    request: { model: "gpt-image-2.5-flare", mode: "create", inputs: {} },
  },
  {
    label: "Nano Banana 2 images",
    icon: <ModelLogo src="/models/google.svg" />,
    request: { model: "nano-banana-2", mode: "create", inputs: {} },
  },
];
/** Fixed prices: keep in step with server `config/models/`. */
const FIXED_FEATURES = [
  { label: "image upscales (4K)", credits: 3, icon: <FrameCorners weight="bold" /> }, // image-upscaler.ts
  { label: "video upscales (Standard)", credits: 10, icon: <FilmStrip weight="bold" /> }, // video-upscaler.ts
];

export function PackCard({
  pack,
  highlight,
  badge,
  action,
  showPerCredit,
}: {
  pack: CreditPack;
  highlight: boolean;
  badge?: string;
  action: CardAction;
  /** Adds the price per credit under the price. */
  showPerCredit?: boolean;
}) {
  const minutes = Math.floor(pack.credits / CLIPPING_CREDITS_PER_MINUTE);
  const perCredit = pack.credits > 0 ? pack.priceUsd / pack.credits : 0;

  // `contents`: see PlanCard.
  return (
    <div className="contents">
      <Panel
        dark={highlight}
        title={`${pack.credits.toLocaleString()} credits`}
        subtitle={
          <p className="flex items-center gap-1.5">
            <Scissors aria-hidden className="size-4 shrink-0" weight="bold" />
            <span>
              Up to <span className="tabular-nums">{minutes.toLocaleString()}</span> min of clipping
            </span>
          </p>
        }
        badge={badge}
        bottom={
          <>
            <Price usd={pack.priceUsd} dark={highlight} />
            {showPerCredit && perCredit ? (
              <p className={cn("mt-1 text-xs tabular-nums", highlight ? "text-white/60" : "text-muted-foreground")}>
                ${perCredit.toFixed(3)} per credit
              </p>
            ) : null}
          </>
        }
      />

      <div>
        <CardButton action={action} primary={highlight} />
      </div>

      <div className="mt-6 px-1 md:mt-7">
        <ListLabel>Or make up to</ListLabel>
        <ul className="mt-4 space-y-3 text-[15px]">
          {LIVE_FEATURES.map((line) => (
            <LivePackLine key={line.label} packCredits={pack.credits} {...line} />
          ))}
          {FIXED_FEATURES.map(({ label, credits, icon }) => (
            <PackLine key={label} icon={icon} amount={Math.floor(pack.credits / credits).toLocaleString()}>
              {label}
            </PackLine>
          ))}
        </ul>
        <p className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
          <IconChip>
            <ModelLogo src="/models/kling.svg" />
          </IconChip>
          Plus Kling, avatars, thumbnails, voiceovers and more.
        </p>
      </div>
    </div>
  );
}

/** The round mark each line starts with: a model logo or an icon. */
function IconChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-foreground ring-1 ring-border [&_svg]:size-3.5">
      {children}
    </span>
  );
}

/** A line priced live. Left out if its price can't be fetched. */
function LivePackLine({
  packCredits,
  label,
  icon,
  request,
}: {
  packCredits: number;
  label: string;
  icon: React.ReactNode;
  request: CatalogRequest;
}) {
  const { quote, error } = useCatalogQuote(request);
  if (error || (quote && !quote.credits)) return null;
  return (
    <PackLine
      icon={icon}
      amount={quote?.credits ? Math.floor(packCredits / quote.credits).toLocaleString() : null}
    >
      {label}
    </PackLine>
  );
}

function PackLine({
  amount,
  icon,
  children,
}: {
  /** Null while its live price loads. */
  amount: string | null;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3">
      <IconChip>{icon}</IconChip>
      {amount ? (
        <span>
          <span className="font-semibold tabular-nums">{amount}</span> {children}
        </span>
      ) : (
        <Skeleton className="my-0.5 h-4 w-40" />
      )}
    </li>
  );
}
