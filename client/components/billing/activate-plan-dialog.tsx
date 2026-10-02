"use client";

import { Lightning } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface ActivatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True while the activate mutation is in flight. */
  isActivating: boolean;
  /** Called when the user confirms activation. */
  onConfirm: () => void | Promise<unknown>;
}

/**
 * Single-step confirmation for converting a free trial into a paid
 * subscription immediately. The trial is ended and the saved card is
 * charged for a full cycle of the user's plan.
 */
export function ActivatePlanDialog({
  open,
  onOpenChange,
  isActivating,
  onConfirm,
}: ActivatePlanDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Activate plan</DialogTitle>
        <DialogDescription className="sr-only">
          Confirm that you want to end your trial and activate your plan now.
        </DialogDescription>

        <div className="p-6 space-y-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <Lightning weight="fill" className="size-5 text-primary" />
          </div>

          <div>
            <h3 className="text-base font-semibold">Activate your plan now?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;re on a free trial. Activate to unlock full credits.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isActivating}
            >
              Not now
            </Button>
            <Button
              className="flex-1"
              disabled={isActivating}
              onClick={() => void onConfirm()}
            >
              {isActivating ? <Spinner /> : "Activate Plan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
