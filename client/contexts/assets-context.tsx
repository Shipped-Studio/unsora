"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { AssetsBrowserDialog } from "@/components/files/assets-browser-dialog";
import type { FilterTab, UnifiedAsset } from "@/hooks/use-all-assets";

interface OpenOptions {
  initialTab?: FilterTab;
  mediaTypeFilter?: "video" | "image";
  multiple?: boolean;
  onSelect?: (asset: UnifiedAsset) => void;
  onSelectMultiple?: (assets: UnifiedAsset[]) => void;
}

interface AssetsContextValue {
  openAssets: (options?: OpenOptions) => void;
  closeAssets: () => void;
  isOpen: boolean;
}

const AssetsContext = createContext<AssetsContextValue | null>(null);

export function AssetsProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<FilterTab>("uploaded");
  const [mediaTypeFilter, setMediaTypeFilter] = useState<
    "video" | "image" | undefined
  >();
  const [multiple, setMultiple] = useState(false);
  const onSelectRef = useRef<((asset: UnifiedAsset) => void) | undefined>(
    undefined,
  );
  const onSelectMultipleRef = useRef<
    ((assets: UnifiedAsset[]) => void) | undefined
  >(undefined);

  const openAssets = useCallback((options?: OpenOptions) => {
    setInitialTab(options?.initialTab ?? "uploaded");
    setMediaTypeFilter(options?.mediaTypeFilter);
    setMultiple(options?.multiple ?? false);
    onSelectRef.current = options?.onSelect;
    onSelectMultipleRef.current = options?.onSelectMultiple;
    setIsOpen(true);
  }, []);

  const closeAssets = useCallback(() => setIsOpen(false), []);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      onSelectRef.current = undefined;
      onSelectMultipleRef.current = undefined;
    }
  }, []);

  return (
    <AssetsContext.Provider value={{ openAssets, closeAssets, isOpen }}>
      {children}
      {/* <AssetsBrowserDialog
        open={isOpen}
        onOpenChange={handleOpenChange}
        initialTab={initialTab}
        mediaTypeFilter={mediaTypeFilter}
        multiple={multiple}
        onSelect={onSelectRef.current}
        onSelectMultiple={onSelectMultipleRef.current}
      /> */}
    </AssetsContext.Provider>
  );
}

export function useAssets() {
  const context = useContext(AssetsContext);
  if (!context) {
    throw new Error("useAssets must be used within an AssetsProvider");
  }
  return context;
}
