"use client";

import { ArrowsClockwise } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { SubscriptionPlan } from "@/hooks/use-subscription-plans";

interface UpgradePlanDialogProps {
  /** The plan the user is switching TO. Dialog is closed when null. */
  targetPlan: SubscriptionPlan | null;
  onOpenChange: (open: boolean) => void;
  currentPlanName: string;
  /** True while the upgrade checkout session is being created. */
  isUpgrading: boolean;
  /** Called when the user confirms; redirects to Stripe Checkout. */
  onConfirm: () => void | Promise<unknown>;
}

/**
 * Confirmation step before a plan switch. Spells out the side effects that
 * make this different from a normal purchase:
 *   1. The current subscription is cancelled once the new plan is paid.
 *   2. Unused PLAN credits are added on top of the new plan's bucket.
 *   3. Top-up credits are unaffected — they never expire and carry no plan.
 * Confirming opens Stripe Checkout — nothing changes until payment succeeds.
 */
export function UpgradePlanDialog({
  targetPlan,
  onOpenChange,
  currentPlanName,
  isUpgrading,
  onConfirm,
}: UpgradePlanDialogProps) {
  return (
    <Dialog open={!!targetPlan} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Switch plan</DialogTitle>
        <DialogDescription className="sr-only">
          Confirm that you want to switch to a new plan. Your current
          subscription will be cancelled and remaining credits carry over.
        </DialogDescription>

        <div className="p-6 space-y-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <ArrowsClockwise weight="bold" className="size-5 text-primary" />
          </div>

          <div>
            <h3 className="text-base font-semibold">
              Switch to {targetPlan?.name}?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your {currentPlanName} subscription will be cancelled as soon as
              the new plan is paid, and any unused {currentPlanName} plan
              credits will be added on top of the{" "}
              {targetPlan?.credits.toLocaleString()} credits of your new plan.
              Top-up credits are not affected and stay in your account as they
              are.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isUpgrading}
            >
              Not now
            </Button>
            <Button
              className="flex-1"
              disabled={isUpgrading}
              onClick={() => void onConfirm()}
            >
              {isUpgrading ? <Spinner /> : "Continue to Checkout"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
