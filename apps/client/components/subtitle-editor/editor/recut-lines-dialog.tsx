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
import { presetLayout } from "@/components/subtitle-editor/caption-style";
import type { SubtitleStylePreset } from "@/components/subtitle-editor/style-presets";

/**
 * Asked when a new template cuts lines differently and the user has edited
 * theirs by hand: re-cut them for the template, or keep them as they are.
 */
export function RecutLinesDialog({
  preset,
  onRecut,
  onKeepLines,
  onCancel,
}: {
  /** The template being switched to; the dialog is open while it's set. */
  preset: SubtitleStylePreset | null;
  onRecut: () => void;
  onKeepLines: () => void;
  onCancel: () => void;
}) {
  const words = preset ? presetLayout(preset).wordsPerCaption : 0;

  return (
    <AlertDialog
      open={preset !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Re-cut the lines for this style?</AlertDialogTitle>
          <AlertDialogDescription>
            {preset
              ? `${preset.name} shows up to ${words} ${words === 1 ? "word" : "words"} at a time. `
              : ""}
            Re-cutting replaces line breaks and lines you moved or split by hand.
            Your word edits stay.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onKeepLines}>Keep my lines</AlertDialogCancel>
          <AlertDialogAction onClick={onRecut}>Re-cut lines</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
