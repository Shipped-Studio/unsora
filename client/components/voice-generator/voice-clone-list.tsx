"use client";

import { Trash } from "@phosphor-icons/react";
import { useVoiceClones } from "@/hooks/use-voice-clones";
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
import { Spinner } from "@/components/ui/spinner";

export function VoiceCloneList() {
  const { catalog, loading, deleteClone } = useVoiceClones();

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
        <Spinner className="size-4" />
        Loading cloned voices…
      </div>
    );
  }

  if (catalog.clones.length === 0) {
    return (
      <p className="py-2 text-xs text-muted-foreground">
        No cloned voices yet. Use the Clone button above to add one.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {catalog.clones.map((clone) => (
        <li
          key={clone.id}
          className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{clone.name}</p>
            {clone.description && (
              <p className="truncate text-[10px] text-muted-foreground">
                {clone.description}
              </p>
            )}
          </div>
          <AlertDialog>
            <AlertDialogTrigger
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Delete ${clone.name}`}
            >
              <Trash className="size-4" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete &quot;{clone.name}&quot;?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the clone from your account and ElevenLabs. You
                  cannot undo this action.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => void deleteClone(clone.id)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </li>
      ))}
    </ul>
  );
}
