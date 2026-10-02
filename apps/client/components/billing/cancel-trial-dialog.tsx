"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";

interface CancelTrialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  isCancelling: boolean;
  onConfirm: () => void;
}

/**
 * Cancelling a trial is immediate (no end-of-period grace), so this is a
 * single confirmation.
 */
export function CancelTrialDialog({
  open,
  onOpenChange,
  planName,
  isCancelling,
  onConfirm,
}: CancelTrialDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel your trial?</AlertDialogTitle>
          <AlertDialogDescription>
            Your {planName} trial ends now and your account moves to Free.
            Remaining trial credits are removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isCancelling}>Keep trial</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isCancelling}
            onClick={onConfirm}
          >
            {isCancelling ? <Spinner data-icon="inline-start" /> : null}
            Cancel trial
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
