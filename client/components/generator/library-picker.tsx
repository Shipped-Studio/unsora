"use client";

import { LibraryPickerDialog } from "@/components/files/library-picker-dialog";
import type { LibraryItem } from "@/hooks/use-library";
import { kindFromAccept, type UploadField } from "./attachments";

interface LibraryPickerProps {
  /** The upload slot being filled; null keeps the dialog closed. */
  field: UploadField | null;
  /** Current attachment count per field key, used for the multi-select cap. */
  fileCounts: Record<string, number>;
  onSelect: (field: UploadField, items: LibraryItem[]) => void;
  onClose: () => void;
}

/** Library picker bound to a single upload slot of a Create tool. */
export function LibraryPicker({
  field,
  fileCounts,
  onSelect,
  onClose,
}: LibraryPickerProps) {
  if (!field) return null;

  const remaining = field.max - (fileCounts[field.key] ?? 0);

  return (
    <LibraryPickerDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      mediaType={kindFromAccept(field.accept)}
      multiple={remaining > 1}
      max={Math.max(1, remaining)}
      onSelect={(items) => onSelect(field, items)}
    />
  );
}
