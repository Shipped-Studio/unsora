"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { CANCEL_REASONS, type CancelReason } from "./constants";

interface CancelSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  /** Formatted end of the current period, when known. */
  endsOn: string | null;
  /** True while the billing portal URL is being fetched. */
  isCancelling: boolean;
  onConfirm: (reason: CancelReason) => void;
}

/**
 * Two steps: pick a reason, then confirm. Confirming opens the Stripe
 * billing portal, where the cancellation is completed.
 */
export function CancelSubscriptionDialog({
  open,
  onOpenChange,
  planName,
  endsOn,
  isCancelling,
  onConfirm,
}: CancelSubscriptionDialogProps) {
  const [step, setStep] = useState<"reason" | "confirm">("reason");
  const [reason, setReason] = useState<CancelReason | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) {
          setStep("reason");
          setReason(null);
        }
      }}
    >
      <DialogContent>
        {step === "reason" ? (
          <>
            <DialogHeader>
              <DialogTitle>Why are you cancelling?</DialogTitle>
              <DialogDescription>
                Pick the closest reason to continue.
              </DialogDescription>
            </DialogHeader>
            <RadioGroup
              value={reason}
              onValueChange={(value) => setReason(value as CancelReason)}
              className="gap-2"
            >
              {CANCEL_REASONS.map((r, i) => (
                <FieldLabel key={r} htmlFor={`cancel-reason-${i}`}>
                  <Field orientation="horizontal">
                    <RadioGroupItem value={r} id={`cancel-reason-${i}`} />
                    <span className="text-sm font-normal">{r}</span>
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Keep plan
              </Button>
              <Button disabled={!reason} onClick={() => setStep("confirm")}>
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Cancel your {planName} plan?</DialogTitle>
              <DialogDescription>
                You&apos;ll finish cancelling in the Stripe billing portal. You
                keep access and your credits until{" "}
                {endsOn ?? "the end of the billing period"}, then your account
                moves to Free.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={isCancelling}
                onClick={() => onOpenChange(false)}
              >
                Keep plan
              </Button>
              <Button
                variant="destructive"
                disabled={isCancelling || !reason}
                onClick={() => reason && onConfirm(reason)}
              >
                {isCancelling ? <Spinner data-icon="inline-start" /> : null}
                Continue to Stripe
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
