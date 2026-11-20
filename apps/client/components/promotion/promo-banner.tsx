"use client";

import { useState, useSyncExternalStore } from "react";
import { ArrowRight, Check, Copy, Tag, X } from "@phosphor-icons/react";
import { usePricing } from "@/contexts/pricing-context";
import { coversLabel, discountLabel, durationLabel, usePromotion, type Promotion } from "@/hooks/use-promotion";
import { hasPaidPlan } from "@/components/onboarding/setup";
import { hasCreditPlan, useUserUsage } from "@/hooks/use-user-usage";

const DISMISSED = (code: string) => `promo-dismissed:${code}`;

// Dismissals live in localStorage; this lets the banner hear its own writes.
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
function isDismissed(code: string) {
  try {
    return window.localStorage.getItem(DISMISSED(code)) === "1";
  } catch {
    return false;
  }
}

/** "50% off the scheduler for 6 months", unless the admin wrote a line. */
export function promotionHeadline(promo: Promotion) {
  return promo.bannerText || `${discountLabel(promo)} ${coversLabel(promo)} ${durationLabel(promo)}`;
}

/**
 * A slim bar across the top of the app while a promotion runs: what it is,
 * the code (one click to copy) and a way to the plans it covers. Hidden from
 * people who already pay for everything it discounts, and once dismissed
 * (per code, so the next promotion shows again).
 */
export function PromoBanner() {
  const promo = usePromotion();
  const { usage } = useUserUsage();
  const { openPricing, openMonthlyCredits, openCredits } = usePricing();
  const [copied, setCopied] = useState(false);
  // Hidden on the server and until the browser says otherwise, so a dismissed
  // banner never flashes in.
  const dismissed = useSyncExternalStore(
    subscribe,
    () => (promo ? isDismissed(promo.code) : true),
    () => true,
  );

  if (!promo || dismissed) return null;
  const nothingToGain =
    (!promo.covers.scheduler || hasPaidPlan(usage)) &&
    (!promo.covers.aiStudio || hasCreditPlan(usage)) &&
    !promo.covers.packs;
  if (usage && nothingToGain) return null;

  const showPlans = promo.covers.scheduler ? openPricing : promo.covers.aiStudio ? openMonthlyCredits : openCredits;
  const copy = () => {
    void navigator.clipboard?.writeText(promo.code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };
  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED(promo.code), "1");
    } catch {
      // Private mode: it just shows again next time.
    }
    listeners.forEach((listener) => listener());
  };

  return (
    <div className="relative flex min-h-10 items-center justify-center gap-x-3 gap-y-1 bg-foreground px-10 py-1.5 text-[13px] text-background max-sm:flex-wrap">
      <Tag aria-hidden className="size-4 shrink-0 max-sm:hidden" weight="fill" />
      <p className="font-medium">{promotionHeadline(promo)}</p>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-background/40 px-2 py-0.5 font-mono text-xs tracking-wider transition-colors hover:bg-background/10"
        aria-label={`Copy code ${promo.code}`}
      >
        {promo.code}
        {copied ? <Check className="size-3.5" weight="bold" /> : <Copy className="size-3.5" />}
      </button>
      <button
        type="button"
        onClick={showPlans}
        className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
      >
        See plans
        <ArrowRight className="size-3.5" weight="bold" />
      </button>
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-background/70 transition-colors hover:bg-background/10 hover:text-background"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
