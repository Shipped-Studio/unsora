"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export function RenameDialog({
  open,
  onOpenChange,
  currentTitle,
  onRename,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTitle: string;
  /** Resolves true when renamed, which closes the dialog. */
  onRename: (title: string) => Promise<boolean>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
          <DialogDescription className="sr-only">
            The name shows in your projects list and as the export file name.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted per opening, so the field starts from the current title. */}
        <RenameForm
          currentTitle={currentTitle}
          onRename={async (next) => {
            if (await onRename(next)) onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({
  currentTitle,
  onRename,
}: {
  currentTitle: string;
  onRename: (title: string) => Promise<void>;
}) {
  const inputId = useId();
  const [value, setValue] = useState(currentTitle);
  const [isSaving, setIsSaving] = useState(false);
  const trimmed = value.trim();
  const unchanged = !trimmed || trimmed === currentTitle;

  return (
    <form
      className="space-y-6"
      onSubmit={async (event) => {
        event.preventDefault();
        if (unchanged) return;
        setIsSaving(true);
        await onRename(trimmed);
        setIsSaving(false);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={inputId}>Name</Label>
        <Input
          id={inputId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          maxLength={120}
        />
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" disabled={isSaving || unchanged}>
          {isSaving ? <Spinner /> : null}
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
