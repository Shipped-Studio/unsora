"use client";

import type { UnifiedAsset } from "@/hooks/use-all-assets";
import { GenericAssetDialog } from "./generic-asset-dialog";

interface AssetDetailDialogProps {
  asset: UnifiedAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (asset: UnifiedAsset) => void;
  isDeleting?: boolean;
}

export function AssetDetailDialog({
  asset,
  open,
  onOpenChange,
  onDelete,
  isDeleting,
}: AssetDetailDialogProps) {
  return (
    <GenericAssetDialog
      asset={asset}
      open={open}
      onOpenChange={onOpenChange}
      onDelete={onDelete}
      isDeleting={isDeleting}
    />
  );
}
