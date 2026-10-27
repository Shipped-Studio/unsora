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

/**
 * Confirms a destructive action. Stays open until the request settles; the
 * caller closes it on success.
 */
export function DeleteDialog({
  open,
  title,
  description,
  isDeleting,
  onConfirm,
  onCancel,
  confirmLabel = "Delete",
  pendingLabel = "Deleting…",
}: {
  open: boolean;
  title: string;
  description: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** The action's verb, e.g. "Remove". */
  confirmLabel?: string;
  pendingLabel?: string;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isDeleting) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isDeleting}
            onClick={onConfirm}
          >
            {isDeleting ? <Spinner /> : null}
            {isDeleting ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
