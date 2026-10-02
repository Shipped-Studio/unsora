"use client";

import { Warning } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface CancelTrialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Display name of the user's current trial plan (e.g. "Pro"). */
  currentPlanName: string;
  /** True while the cancel-trial mutation is in flight. */
  isCancelling: boolean;
  /** Called when the user confirms cancellation. */
  onConfirm: () => void | Promise<unknown>;
}

/**
 * Single-step confirmation for cancelling a free trial. Unlike the paid
 * cancellation flow, this happens immediately — there is no end-of-period
 * grace, so we skip the retention pitch and just ask "are you sure?".
 */
export function CancelTrialDialog({
  open,
  onOpenChange,
  currentPlanName,
  isCancelling,
  onConfirm,
}: CancelTrialDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Cancel trial</DialogTitle>
        <DialogDescription className="sr-only">
          Confirm that you want to end your free trial.
        </DialogDescription>

        <div className="p-6 space-y-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10">
            <Warning weight="fill" className="size-5 text-destructive" />
          </div>

          <div>
            <h3 className="text-base font-semibold">Cancel your trial?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your{" "}
              <span className="font-medium text-foreground">
                {currentPlanName}
              </span>{" "}
              trial will end immediately and your account will revert to Free.
              Any remaining trial credits will be lost.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isCancelling}
            >
              Keep Trial
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={isCancelling}
              onClick={() => void onConfirm()}
            >
              {isCancelling ? <Spinner /> : "Cancel Trial"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
