"use client";

import { useState, useCallback, useRef } from "react";
import {
  CloudArrowUp,
  FolderOpen,
  Play,
  ImageSquare,
  VideoCamera,
  UploadSimple,
  Warning,
  CheckCircle,
  X,
} from "@phosphor-icons/react";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCdnUrl } from "@/lib/video-utils";
import { uploadFileToStorage } from "@/lib/storage-client";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { Spinner } from "@/components/ui/spinner";
import { VideoThumbnail } from "@/components/ui/video-thumbnail";
import { AssetCard } from "@/components/files/asset-card";
import { AssetDetailDialog } from "@/components/files/asset-detail-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useInfiniteAssetsByCategory,
  FILTER_TABS,
  assetQueryKeys,
  type FilterTab,
  type UnifiedAsset,
} from "@/hooks/use-all-assets";

interface AssetsBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: FilterTab;
  mediaTypeFilter?: "video" | "image" | "audio";
  multiple?: boolean;
  onSelect?: (asset: UnifiedAsset) => void;
  onSelectMultiple?: (assets: UnifiedAsset[]) => void;
}

const cdnLoader = ({ src }: { src: string }) => src;

const UPLOAD_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav";

function getAssetType(mimeType: string): "IMAGE" | "VIDEO" | "AUDIO" {
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  return "IMAGE";
}

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

export function AssetsBrowserDialog({
  open,
  onOpenChange,
  initialTab = "uploaded",
  mediaTypeFilter,
  multiple = false,
  onSelect,
  onSelectMultiple,
}: AssetsBrowserDialogProps) {
  const validInitial = FILTER_TABS.some((t) => t.value === initialTab)
    ? initialTab
    : "uploaded";
  const [activeTab, setActiveTab] = useState<FilterTab>(validInitial);
  const [selectedAsset, setSelectedAsset] = useState<UnifiedAsset | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  const isSelectMode = !!(onSelect || onSelectMultiple);
  const canMultiSelect = multiple && !!onSelectMultiple;

  const visibleTabs = mediaTypeFilter
    ? FILTER_TABS.filter(
        (t) =>
          t.value === "uploaded" ||
          (mediaTypeFilter === "image" && t.value === "image") ||
          (mediaTypeFilter === "video" && t.value === "video"),
      )
    : FILTER_TABS;

  const {
    assets: rawAssets,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteAssetsByCategory(activeTab);

  const assets = mediaTypeFilter
    ? rawAssets.filter((a) => a.mediaType === mediaTypeFilter)
    : rawAssets;

  const allAssets = rawAssets;
  const selectedAssets = allAssets.filter((a) => selectedIds.has(a.id));

  function toggleSelect(asset: UnifiedAsset) {
    if (canMultiSelect) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(asset.id)) {
          next.delete(asset.id);
        } else {
          next.add(asset.id);
        }
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        if (prev.has(asset.id)) return new Set();
        return new Set([asset.id]);
      });
    }
  }

  function handleConfirmSelection() {
    const selected = allAssets.filter((a) => selectedIds.has(a.id));
    if (selected.length === 0) return;

    if (onSelectMultiple) {
      onSelectMultiple(selected);
    } else if (onSelect && selected.length > 0) {
      onSelect(selected[0]);
    }
    onOpenChange(false);
  }

  const handleAssetClick = useCallback(
    (asset: UnifiedAsset) => {
      if (isSelectMode) {
        toggleSelect(asset);
      } else {
        setSelectedAsset(asset);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSelectMode, canMultiSelect, onSelect, onSelectMultiple, onOpenChange],
  );

  const uploadSingleFile = useCallback(
    async (file: File, uploadId: string) => {
      try {
        const result = await uploadFileToStorage(file, (p) => {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === uploadId ? { ...u, progress: p.percentage } : u,
            ),
          );
        });

        if (!result.success || !result.blobUrl) {
          throw new Error(result.error || "Upload failed");
        }

        const res = await authFetch("/api/assets", {
          method: "POST",
          body: JSON.stringify({
            name: file.name,
            url: result.blobUrl,
            mimeType: file.type,
            type: getAssetType(file.type),
            fileSize: file.size,
          }),
        });

        if (!res.ok) throw new Error("Failed to register asset");

        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId ? { ...u, status: "done", progress: 100 } : u,
          ),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId ? { ...u, status: "error", error: msg } : u,
          ),
        );
      }
    },
    [authFetch],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArr = Array.from(files);
      if (fileArr.length === 0) return;

      const newUploads: UploadItem[] = fileArr.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        progress: 0,
        status: "uploading" as const,
      }));

      setUploads((prev) => [...newUploads, ...prev]);

      for (const upload of newUploads) {
        uploadSingleFile(upload.file, upload.id).then(() => {
          queryClient.invalidateQueries({
            queryKey: [...assetQueryKeys.all, "infinite", "uploaded"],
          });
        });
      }
    },
    [uploadSingleFile, queryClient],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const activeUploads = uploads.filter((u) => u.status === "uploading");
  const hasActiveUploads = activeUploads.length > 0;

  function dismissUpload(id: string) {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }

  function handleClose(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setSelectedAsset(null);
      setSelectedIds(new Set());
      setUploads((prev) => prev.filter((u) => u.status === "uploading"));
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          className="flex h-[85vh] max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
          showCloseButton
        >
          <DialogTitle className="sr-only">Browse Assets</DialogTitle>
          <DialogDescription className="sr-only">
            Browse and select assets
          </DialogDescription>

          {/* Header */}
          <div className="shrink-0 border-b">
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <div>
                <h2 className="text-base font-semibold">
                  {isSelectMode ? "Select Assets" : "All Assets"}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {canMultiSelect
                    ? "Click assets to select multiple"
                    : isSelectMode
                      ? "Pick an asset to use"
                      : "All your generated assets in one place"}
                </p>
              </div>
              {hasActiveUploads && (
                <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5">
                  <Spinner className="size-3" />
                  <span className="text-xs font-medium text-primary">
                    Uploading {activeUploads.length} file
                    {activeUploads.length > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>

            <div className="px-5">
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      "relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors",
                      activeTab === tab.value
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                    {activeTab === tab.value && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto p-5">
            {/* Upload zone — always shown on uploads tab */}
            {activeTab === "uploaded" && (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                className={cn(
                  "mb-4 rounded-xl border-2 border-dashed p-6 text-center transition-all",
                  isDragOver
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : "border-border hover:border-primary/40",
                )}
              >
                <CloudArrowUp
                  className={cn(
                    "mx-auto size-10 transition-colors",
                    isDragOver
                      ? "text-primary"
                      : "text-muted-foreground/50",
                  )}
                  weight="thin"
                />
                <p className="mt-3 text-sm font-medium">
                  Drag & drop files here
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Images, videos, or audio — upload one or many at once
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 rounded-full"
                  onClick={() => uploadInputRef.current?.click()}
                >
                  Browse files
                </Button>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept={UPLOAD_ACCEPT}
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFiles(e.target.files);
                    }
                    e.target.value = "";
                  }}
                />
              </div>
            )}

            {/* Active upload progress cards */}
            {uploads.length > 0 && activeTab === "uploaded" && (
              <div className="mb-4 space-y-2">
                {uploads.map((u) => (
                  <div
                    key={u.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2.5",
                      u.status === "error" && "border-destructive/30 bg-destructive/5",
                      u.status === "done" && "border-success/30 bg-success/5",
                    )}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      {u.status === "uploading" && (
                        <Spinner className="size-3.5" />
                      )}
                      {u.status === "done" && (
                        <CheckCircle
                          className="size-4 text-success"
                          weight="fill"
                        />
                      )}
                      {u.status === "error" && (
                        <Warning className="size-4 text-destructive" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {u.file.name}
                      </p>
                      {u.status === "uploading" && (
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${u.progress}%` }}
                          />
                        </div>
                      )}
                      {u.status === "error" && (
                        <p className="mt-0.5 text-[11px] text-destructive">
                          {u.error}
                        </p>
                      )}
                      {u.status === "done" && (
                        <p className="mt-0.5 text-[11px] text-success">
                          Uploaded
                        </p>
                      )}
                    </div>
                    {u.status === "uploading" && (
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {u.progress}%
                      </span>
                    )}
                    {u.status !== "uploading" && (
                      <button
                        onClick={() => dismissUpload(u.id)}
                        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Assets grid */}
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-video rounded-xl" />
                ))}
              </div>
            ) : !assets || assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <FolderOpen
                  className="size-12 text-muted-foreground/40"
                  weight="thin"
                />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    No assets found
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    {activeTab === "uploaded"
                      ? "Upload some files to get started"
                      : "No assets in this category yet"}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {assets.map((asset) =>
                    isSelectMode ? (
                      <AssetPickerCard
                        key={`${asset.category}-${asset.id}`}
                        asset={asset}
                        selected={selectedIds.has(asset.id)}
                        showCheckbox
                        onClick={() => handleAssetClick(asset)}
                      />
                    ) : (
                      <AssetCard
                        key={`${asset.category}-${asset.id}`}
                        asset={asset}
                        onClick={() => handleAssetClick(asset)}
                      />
                    ),
                  )}
                </div>
                {hasNextPage && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                      {isFetchingNextPage ? (
                        <>
                          <Spinner className="size-3" />
                          Loading…
                        </>
                      ) : (
                        "Load more"
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t bg-muted/50 px-5 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isSelectMode && selectedIds.size > 0 && (
                  <>
                    <span className="text-sm font-medium">
                      {selectedIds.size} selected
                    </span>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear all
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => handleClose(false)}
                >
                  Cancel
                </Button>
                {isSelectMode && (
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={selectedIds.size === 0}
                    onClick={handleConfirmSelection}
                  >
                    Confirm{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {!isSelectMode && (
        <AssetDetailDialog
          asset={selectedAsset}
          open={selectedAsset !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setSelectedAsset(null);
          }}
        />
      )}
    </>
  );
}

function AssetPickerCard({
  asset,
  selected,
  showCheckbox,
  onClick,
}: {
  asset: UnifiedAsset;
  selected: boolean;
  showCheckbox: boolean;
  onClick: () => void;
}) {
  const isProcessing =
    asset.status === "QUEUED" ||
    asset.status === "PROCESSING" ||
    asset.status === "queued" ||
    asset.status === "processing";
  const isFailed = asset.status === "FAILED" || asset.status === "failed";
  const isVideo = asset.mediaType === "video";
  const isImage = asset.mediaType === "image";
  const isAudio = asset.mediaType === "audio";

  const outputUrl = asset.outputUrl ? getCdnUrl(asset.outputUrl) : null;
  const thumbUrl = asset.thumbnailUrl ? getCdnUrl(asset.thumbnailUrl) : null;
  const displayUrl = outputUrl || thumbUrl;
  const label = asset.prompt || asset.name || "Untitled";

  const disabled = isProcessing || isFailed || !outputUrl;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card text-left transition-all",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer",
        selected
          ? "ring-2 ring-primary border-primary"
          : "hover:ring-2 hover:ring-primary/30",
      )}
    >
      {/* Selection indicator */}
      {showCheckbox && (
        <div className="absolute right-2 top-2 z-10">
          <div
            className={cn(
              "flex size-5 items-center justify-center rounded-full border-2 transition-all",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-white/70 bg-black/30 backdrop-blur-sm",
            )}
          >
            {selected && <CheckCircle className="size-3.5" weight="fill" />}
          </div>
        </div>
      )}

      <div
        className={cn(
          "relative w-full overflow-hidden bg-muted",
          isVideo ? "aspect-video" : "aspect-square",
        )}
      >
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </div>
        )}

        {isFailed && (
          <div className="absolute inset-0 flex items-center justify-center bg-destructive/5">
            <Warning className="size-5 text-destructive" />
          </div>
        )}

        {!isProcessing && !isFailed && displayUrl && isVideo && (
          <>
            <VideoThumbnail
              videoUrl={outputUrl}
              thumbnailUrl={thumbUrl}
              alt={label}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <div className="flex size-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm">
                <Play className="ml-0.5 size-3.5" weight="fill" />
              </div>
            </div>
          </>
        )}

        {!isProcessing && !isFailed && displayUrl && isImage && (
          <Image
            loader={cdnLoader}
            src={displayUrl}
            alt={label}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover"
          />
        )}

        {!isProcessing && !isFailed && displayUrl && isAudio && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <UploadSimple className="size-6 text-white/80" />
          </div>
        )}

        {!isProcessing && !isFailed && !displayUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            {isVideo ? (
              <VideoCamera className="size-6 text-muted-foreground/30" />
            ) : isImage ? (
              <ImageSquare className="size-6 text-muted-foreground/30" />
            ) : (
              <UploadSimple className="size-6 text-muted-foreground/30" />
            )}
          </div>
        )}
      </div>

      <div className="px-2.5 py-2 absolute bottom-0 left-0 right-0 bg-linear-to-t from-background to-transparent">
        <p className="truncate text-[11px] font-medium">{label}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {new Date(asset.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
    </button>
  );
}
