"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlanGrid, usePlanChoice } from "@/components/billing/plan-grid";
import { cn } from "@/lib/utils";

interface PricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PricingDialog({ open, onOpenChange }: PricingDialogProps) {
  const choice = usePlanChoice(open);
  const count = choice.shown?.length ?? 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0",
          count >= 4 ? "sm:max-w-7xl" : "sm:max-w-5xl",
        )}
      >
        <DialogHeader className="border-b p-6 pr-12">
          <DialogTitle>{choice.isPaid ? "Change plan" : "Choose a plan"}</DialogTitle>
          <DialogDescription>{choice.description}</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto overscroll-contain p-6">
          <PlanGrid choice={choice} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
