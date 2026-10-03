"use client";

import { useState } from "react";
import { Trash } from "@phosphor-icons/react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useVoiceClones, type VoiceClone } from "@/hooks/use-voice-clones";

/** The user's cloned voices, with delete. */
export function VoiceCloneList() {
  const { catalog, loading, isError, refresh, deleteClone } = useVoiceClones();
  const [pending, setPending] = useState<VoiceClone | null>(null);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Couldn&apos;t load your cloned voices.</span>
        <Button variant="ghost" size="xs" onClick={() => void refresh()}>
          Try again
        </Button>
      </div>
    );
  }

  if (catalog.clones.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No cloned voices yet. Use Clone next to the voice picker to add one.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y rounded-xl border">
        {catalog.clones.map((clone) => (
          <li
            key={clone.id}
            className="flex items-center justify-between gap-2 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{clone.name}</p>
              {clone.description ? (
                <p className="truncate text-xs text-muted-foreground">
                  {clone.description}
                </p>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPending(clone)}
              aria-label={`Delete ${clone.name}`}
            >
              <Trash />
            </Button>
          </li>
        ))}
      </ul>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pending?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The cloned voice is removed from your account and ElevenLabs.
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pending) {
                  // The mutation reports its own errors.
                  deleteClone(pending.id).catch(() => undefined);
                }
                setPending(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** "Manage voices" link beside the voice picker: lists cloned voices with delete. */
export function ManageVoicesButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="-mr-1.5 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        Manage voices
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your cloned voices</DialogTitle>
            <DialogDescription>
              Voices you cloned show up in the voice picker. Deleting one
              removes it everywhere.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60svh] overflow-y-auto">
            <VoiceCloneList />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
