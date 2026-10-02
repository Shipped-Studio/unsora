"use client";

import { AssetsBrowserDialog } from "@/components/files/assets-browser-dialog";
import type { UnifiedAsset } from "@/hooks/use-all-assets";
import { kindFromAccept, type UploadField } from "./attachments";

interface LibraryPickerProps {
  /** The upload slot being filled; null keeps the dialog closed. */
  field: UploadField | null;
  /** Current attachment count per field key, used for the multi-select cap. */
  fileCounts: Record<string, number>;
  onSelect: (field: UploadField, assets: UnifiedAsset[]) => void;
  onClose: () => void;
}

/** Media library dialog bound to a single upload slot. */
export function LibraryPicker({
  field,
  fileCounts,
  onSelect,
  onClose,
}: LibraryPickerProps) {
  if (!field) return null;

  const kind = kindFromAccept(field.accept);

  return (
    <AssetsBrowserDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      mediaTypeFilter={kind}
      initialTab={
        kind === "image" ? "image" : kind === "video" ? "video" : "uploaded"
      }
      multiple={field.max - (fileCounts[field.key] ?? 0) > 1}
      onSelectMultiple={(assets) => {
        onSelect(field, assets);
        onClose();
      }}
    />
  );
}
