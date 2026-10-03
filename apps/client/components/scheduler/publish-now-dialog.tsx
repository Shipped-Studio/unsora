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

/** Confirms "Publish now", which skips the schedule and posts right away. */
export function PublishNowDialog({
  open,
  onOpenChange,
  accounts,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** How many accounts the post goes to. */
  accounts: number;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publish now?</AlertDialogTitle>
          <AlertDialogDescription>
            This posts to {accounts} {accounts === 1 ? "account" : "accounts"} right away.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Publish now
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
