"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Warning } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { CANCEL_REASONS, type CancelReason } from "./constants";

interface CancelSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Display name of the user's current plan (e.g. "Pro"). */
  currentPlanName: string;
  /** Monthly credit allowance — shown in the "you'll lose" list. */
  maxCredits: number;
  /** True while the cancel mutation is in flight. */
  isCancelling: boolean;
  /** Called with the user's selected cancel reason on final confirm. */
  onConfirm: (reason: CancelReason) => void | Promise<unknown>;
}

/**
 * Two-step cancellation flow:
 *   1. Why are you leaving? (reason picker)
 *   2. Final "are you sure" confirmation
 *
 * Internal step + reason state lives here so the parent only deals with
 * open/closed and the final confirm callback.
 */
export function CancelSubscriptionDialog({
  open,
  onOpenChange,
  currentPlanName,
  isCancelling,
  onConfirm,
}: CancelSubscriptionDialogProps) {
  const [step, setStep] = useState<0 | 1>(0);
  const [reason, setReason] = useState<CancelReason | null>(null);

  // Reset wizard state every time the dialog re-opens, otherwise the user
  // would see step 3 still selected from a prior session.
  useEffect(() => {
    if (open) {
      setStep(0);
      setReason(null);
    }
  }, [open]);

  const handleFinalConfirm = () => {
    if (!reason) return;
    void onConfirm(reason);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Cancel subscription</DialogTitle>
        <DialogDescription className="sr-only">
          Multi-step cancellation flow
        </DialogDescription>

        <div className="flex items-center gap-2 px-6 pt-6">
          {[0, 1].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold">
                We&apos;re sorry to see you go
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Could you tell us why you&apos;re cancelling? This helps us
                improve.
              </p>
            </div>

            <div className="space-y-2">
              {CANCEL_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={cn(
                    "flex w-full items-center rounded-lg border px-4 py-3 text-sm font-medium transition-all text-left",
                    reason === r
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-foreground hover:border-foreground/20",
                  )}
                >
                  <div
                    className={cn(
                      "mr-3 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      reason === r
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30",
                    )}
                  >
                    {reason === r && (
                      <div className="size-1.5 rounded-full bg-primary-foreground" />
                    )}
                  </div>
                  {r}
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Never mind
              </Button>
              <Button
                className="flex-1"
                disabled={!reason}
                onClick={() => setStep(1)}
              >
                Continue
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="p-6 space-y-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10">
              <Warning weight="fill" className="size-5 text-destructive" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Are you sure?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                You&apos;ll be taken to Stripe to manage and cancel your{" "}
                <span className="font-medium text-foreground">
                  {currentPlanName}
                </span>{" "}
                plan. You&apos;ll keep access until the end of your billing
                period, then your account reverts to Free.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Keep My Plan
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={isCancelling}
                onClick={handleFinalConfirm}
              >
                {isCancelling ? <Spinner /> : "Continue to Stripe"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
