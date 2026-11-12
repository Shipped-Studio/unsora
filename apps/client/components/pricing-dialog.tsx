"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreditPacks } from "@/components/billing/credit-packs";
import { CreditPlanGrid, useCreditPlanChoice } from "@/components/billing/credit-plan-grid";
import { PlanGrid, usePlanChoice } from "@/components/billing/plan-grid";
import { PlanTabs } from "@/components/billing/plan-tabs";
import { useBuyCreditPack } from "@/components/billing/use-buy-credit-pack";
import { useCreditPacks } from "@/hooks/use-credit-packs";
import { cn } from "@/lib/utils";

/** Scheduler plans, Monthly credits tiers, one-time packs. */
export type PricingTab = "plans" | "monthly" | "credits";

interface PricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: PricingTab;
  onTabChange: (tab: PricingTab) => void;
}

const PACKS_DESCRIPTION =
  "Top-ups for when you run out. They never expire, and you can buy them with or without a plan.";

/**
 * The three things on sale, the same cards as on Billing, one tab each:
 * the scheduler plan, Monthly credits (a separate subscription), and
 * one-time packs.
 */
export function PricingDialog({ open, onOpenChange, tab, onTabChange }: PricingDialogProps) {
  const choice = usePlanChoice(open);
  const creditChoice = useCreditPlanChoice();
  const planCount = choice.shown?.length ?? 3;

  const heading = {
    plans: {
      title: choice.isPaid ? "Change scheduler plan" : "Choose a scheduler plan",
      description: choice.description,
    },
    monthly: {
      title: creditChoice.subscribed ? "Change monthly credits" : "Monthly credits",
      description: creditChoice.description,
    },
    credits: { title: "One-time packs", description: PACKS_DESCRIPTION },
  }[tab];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0",
          tab !== "plans" ? "sm:max-w-6xl" : planCount >= 4 ? "sm:max-w-7xl" : "sm:max-w-5xl",
        )}
      >
        <DialogHeader className="space-y-4 border-b p-6 pr-12">
          <PlanTabs
            value={tab}
            onValueChange={onTabChange}
            items={[
              { value: "plans", label: "Scheduler" },
              { value: "monthly", label: "Monthly credits" },
              { value: "credits", label: "One-time packs" },
            ]}
          />
          <div className="space-y-1.5">
            <DialogTitle>{heading.title}</DialogTitle>
            <DialogDescription>{heading.description}</DialogDescription>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto overscroll-contain p-6">
          {tab === "plans" ? <PlanGrid choice={choice} /> : null}
          {tab === "monthly" ? <CreditPlanGrid choice={creditChoice} /> : null}
          {tab === "credits" ? <CreditsPanel /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Mounted only on the Credits tab, so the packs load when they're wanted. */
function CreditsPanel() {
  const packsQuery = useCreditPacks();
  const { pendingPackKey, buy } = useBuyCreditPack();
  return (
    <CreditPacks
      packs={packsQuery.packs}
      loading={packsQuery.loading}
      error={packsQuery.error}
      onRetry={() => void packsQuery.refetch()}
      pendingPackKey={pendingPackKey}
      onBuy={(key) => void buy(key)}
    />
  );
}
