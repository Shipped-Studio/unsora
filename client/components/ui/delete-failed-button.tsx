"use client";

import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeleteFailedButtonProps {
  /** Called when the user confirms deletion in the dialog. */
  onConfirm: () => void;
  /** Dialog title. Defaults to a generic task copy. */
  title?: string;
  /** Dialog body. Defaults to a generic failed-task copy. */
  description?: string;
  /** Extra classes for the positioning wrapper (override placement if needed). */
  className?: string;
}

/**
 * Small "x" button pinned to the top-right corner of a card. On click it opens
 * a confirmation dialog and, on confirm, runs `onConfirm` (typically a delete
 * mutation). Used to let users remove failed tasks directly from their card.
 */
export function DeleteFailedButton({
  onConfirm,
  title = "Delete this task?",
  description = "This will permanently remove this failed task. This action cannot be undone.",
  className,
}: DeleteFailedButtonProps) {
  return (
    <div
      className={cn("absolute right-1.5 top-1.5 z-20", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <AlertDialog>
        <AlertDialogTrigger
          aria-label="Delete failed task"
          className="flex size-6 items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="size-3.5" weight="bold" />
        </AlertDialogTrigger>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onConfirm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
