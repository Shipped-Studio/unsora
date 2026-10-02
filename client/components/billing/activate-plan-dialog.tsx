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

interface ActivatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  isActivating: boolean;
  onConfirm: () => void;
}

/**
 * Ends the free trial now: the saved card is charged for a full cycle and
 * the plan's credits are granted.
 */
export function ActivatePlanDialog({
  open,
  onOpenChange,
  planName,
  isActivating,
  onConfirm,
}: ActivatePlanDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Activate your {planName} plan now?</AlertDialogTitle>
          <AlertDialogDescription>
            Your trial ends immediately and your saved card is charged for the
            plan. You get the plan&apos;s full credits right away.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isActivating}>Not now</AlertDialogCancel>
          <AlertDialogAction disabled={isActivating} onClick={onConfirm}>
            {isActivating ? <Spinner data-icon="inline-start" /> : null}
            Activate plan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
