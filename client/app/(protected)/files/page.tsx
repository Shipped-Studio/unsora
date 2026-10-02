"use client";

import {
  type DragEvent,
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FolderOpen, UploadSimple } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/skeleton";
import { AssetCard } from "@/components/files/asset-card";
import { AssetDetailDialog } from "@/components/files/asset-detail-dialog";
import {
  assetQueryKeys,
  useAssetsByCategory,
  type UnifiedAsset,
} from "@/hooks/use-all-assets";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { uploadFileToStorage } from "@/lib/storage-client";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const PAGE_SIZE = 12;

type ViewTab = "uploads" | "generated";
type FilterGroup = "video-generation" | "image-generation";
type FeatureValue =
  | "all"
  | "omni-reference"
  | "first-last-frames"
  | "text-to-video"
  | "image-to-video"
  | "motion-control"
  | "subtitle-removed"
  | "upscaled-video"
  | "basic-image"
  | "movie-materials"
  | "influencer"
  | "upscale";

const FILTER_GROUPS = [
  {
    value: "video-generation" as const,
    label: "Video Generation",
    category: "video" as const,
  },
  {
    value: "image-generation" as const,
    label: "Image Generation",
    category: "image" as const,
  },
] as const;

const GROUP_FEATURES: Record<
  FilterGroup,
  { value: FeatureValue; label: string; apiFeature?: string }[]
> = {
  "video-generation": [
    { value: "all", label: "All Video Generation" },
    {
      value: "omni-reference",
      label: "Omni Reference",
      apiFeature: "OMNI_REFERENCE",
    },
    {
      value: "first-last-frames",
      label: "First/Last Frames",
      apiFeature: "FIRST_LAST_FRAMES",
    },
    {
      value: "text-to-video",
      label: "Text to Video",
      apiFeature: "TEXT_TO_VIDEO",
    },
    {
      value: "image-to-video",
      label: "Image to Video",
      apiFeature: "IMAGE_TO_VIDEO",
    },
    {
      value: "motion-control",
      label: "Motion Control",
      apiFeature: "MOTION_CONTROL",
    },
    {
      value: "subtitle-removed",
      label: "Subtitle Removed",
      apiFeature: "WATERMARK_REMOVAL",
    },
    {
      value: "upscaled-video",
      label: "Video Upscaled",
      apiFeature: "UPSCALING",
    },
  ],
  "image-generation": [
    { value: "all", label: "All Image Generation" },
    {
      value: "basic-image",
      label: "Basic Image",
      apiFeature: "BASIC",
    },
    {
      value: "movie-materials",
      label: "Movie Materials",
      apiFeature: "MOVIE_MATERIALS",
    },
    {
      value: "influencer",
      label: "Influencer",
      apiFeature: "INFLUENCER",
    },
    {
      value: "upscale",
      label: "Upscale",
      apiFeature: "UPSCALE",
    },
  ],
};

const DEFAULT_TAB: ViewTab = "generated";
const DEFAULT_GROUP: FilterGroup = "video-generation";
const DEFAULT_FEATURE: FeatureValue = "all";

const LEGACY_FEATURE_TO_GROUP: Record<string, FilterGroup> = {
  "omni-reference": "video-generation",
  "first-last-frames": "video-generation",
  "text-to-video": "video-generation",
  "image-to-video": "video-generation",
  "motion-control": "video-generation",
  "subtitle-removed": "video-generation",
  "upscaled-video": "video-generation",
  "basic-image": "image-generation",
  "movie-materials": "image-generation",
  influencer: "image-generation",
  upscale: "image-generation",
};

const LEGACY_FEATURE_TO_VALUE: Record<string, FeatureValue> = {
  "omni-reference": "omni-reference",
  "first-last-frames": "first-last-frames",
  "text-to-video": "text-to-video",
  "image-to-video": "image-to-video",
  "motion-control": "motion-control",
  "subtitle-removed": "subtitle-removed",
  "upscaled-video": "upscaled-video",
  "basic-image": "basic-image",
  "movie-materials": "movie-materials",
  influencer: "influencer",
  upscale: "upscale",
};

const isValidTab = (value: string | null): value is ViewTab =>
  value === "uploads" || value === "generated";
const isValidGroup = (value: string | null): value is FilterGroup =>
  !!value && FILTER_GROUPS.some((group) => group.value === value);
const isValidFeatureForGroup = (
  group: FilterGroup,
  value: string | null,
): value is FeatureValue =>
  !!value && GROUP_FEATURES[group].some((feature) => feature.value === value);

const resolveLegacyParams = (
  params: URLSearchParams,
): { tab: ViewTab; group: FilterGroup; feature: FeatureValue } => {
  const legacy = params.get("feature");
  if (!legacy) {
    return { tab: DEFAULT_TAB, group: DEFAULT_GROUP, feature: DEFAULT_FEATURE };
  }
  if (legacy === "uploads") {
    return { tab: "uploads", group: DEFAULT_GROUP, feature: DEFAULT_FEATURE };
  }
  return {
    tab: "generated",
    group: LEGACY_FEATURE_TO_GROUP[legacy] ?? DEFAULT_GROUP,
    feature: LEGACY_FEATURE_TO_VALUE[legacy] ?? DEFAULT_FEATURE,
  };
};

const getFeatureConfig = (group: FilterGroup, feature: FeatureValue) =>
  GROUP_FEATURES[group].find((item) => item.value === feature) ??
  GROUP_FEATURES[group][0];

const getGroupConfig = (group: FilterGroup) =>
  FILTER_GROUPS.find((item) => item.value === group) ?? FILTER_GROUPS[0];

const FILTER_BADGE_LABEL = (_group: FilterGroup, featureLabel: string) =>
  featureLabel;

const DATE_HEADER_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

const getDayStart = (value: string) => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getDateHeaderLabel = (value: string) => {
  const dayStart = getDayStart(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dayStart.getTime() === today.getTime()) return "Today";
  if (dayStart.getTime() === yesterday.getTime()) return "Yesterday";
  return DATE_HEADER_FORMATTER.format(dayStart);
};

const getAssetType = (
  mimeType: string,
): "image" | "video" | "audio" | "file" => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
};

export default function FilesPage() {
  return (
    <Suspense>
      <FilesContent />
    </Suspense>
  );
}

function FilesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [selectedAsset, setSelectedAsset] = useState<UnifiedAsset | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isDragOverUploadZone, setIsDragOverUploadZone] = useState(false);

  const activeTab = useMemo(() => {
    const rawTab = searchParams.get("tab");
    if (isValidTab(rawTab)) return rawTab;
    return resolveLegacyParams(new URLSearchParams(searchParams.toString()))
      .tab;
  }, [searchParams]);
  const activeGroup = useMemo(() => {
    if (activeTab === "uploads") return DEFAULT_GROUP;
    const rawGroup = searchParams.get("group");
    if (isValidGroup(rawGroup)) return rawGroup;
    return resolveLegacyParams(new URLSearchParams(searchParams.toString()))
      .group;
  }, [activeTab, searchParams]);
  const activeFeature = useMemo(() => {
    if (activeTab === "uploads") return DEFAULT_FEATURE;
    const rawFeature = searchParams.get("feature");
    if (isValidFeatureForGroup(activeGroup, rawFeature)) return rawFeature;
    return resolveLegacyParams(new URLSearchParams(searchParams.toString()))
      .feature;
  }, [activeGroup, activeTab, searchParams]);
  const groupConfig = useMemo(() => getGroupConfig(activeGroup), [activeGroup]);
  const featureConfig = useMemo(
    () => getFeatureConfig(activeGroup, activeFeature),
    [activeFeature, activeGroup],
  );

  const page = useMemo(() => {
    const raw = parseInt(searchParams.get("page") ?? "1", 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  }, [searchParams]);

  const { data, isLoading } = useAssetsByCategory({
    category: activeTab === "uploads" ? "uploaded" : groupConfig.category,
    page,
    limit: PAGE_SIZE,
    feature: activeTab === "uploads" ? undefined : featureConfig.apiFeature,
  });

  const assets = data?.items ?? [];
  const totalCount = data?.pagination.totalCount ?? 0;
  const totalPages = data?.pagination.totalPages ?? 1;
  const groupedAssets = useMemo(() => {
    const groups = new Map<
      string,
      { id: string; label: string; sortValue: number; items: UnifiedAsset[] }
    >();

    for (const asset of assets) {
      const dayStart = getDayStart(asset.createdAt);
      const id = dayStart.toISOString();
      const existing = groups.get(id);
      if (existing) {
        existing.items.push(asset);
        continue;
      }
      groups.set(id, {
        id,
        label: getDateHeaderLabel(asset.createdAt),
        sortValue: dayStart.getTime(),
        items: [asset],
      });
    }

    return Array.from(groups.values())
      .sort((a, b) => b.sortValue - a.sortValue)
      .map((group) => ({
        ...group,
        items: group.items.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      }));
  }, [assets]);

  const updateQueryParams = useCallback(
    (updater: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      updater(params);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setGeneratedFilter = useCallback(
    (group: FilterGroup, feature: FeatureValue) => {
      updateQueryParams((params) => {
        params.set("tab", "generated");
        if (group === DEFAULT_GROUP) {
          params.delete("group");
        } else {
          params.set("group", group);
        }
        if (feature === DEFAULT_FEATURE) {
          params.delete("feature");
        } else {
          params.set("feature", feature);
        }
        params.delete("page");
      });
    },
    [updateQueryParams],
  );

  const setTab = useCallback(
    (tab: ViewTab) => {
      updateQueryParams((params) => {
        if (tab === DEFAULT_TAB) {
          params.delete("tab");
        } else {
          params.set("tab", tab);
        }
        if (tab === "uploads") {
          params.delete("group");
          params.delete("feature");
        }
        params.delete("page");
      });
    },
    [updateQueryParams],
  );

  const goToPage = useCallback(
    (targetPage: number) => {
      if (targetPage < 1 || targetPage > totalPages) return;
      updateQueryParams((params) => {
        if (targetPage === 1) {
          params.delete("page");
        } else {
          params.set("page", String(targetPage));
        }
      });
    },
    [totalPages, updateQueryParams],
  );

  const deleteAsset = useCallback(
    async (asset: UnifiedAsset) => {
      let endpoint = "";
      if (asset.category === "uploaded") {
        endpoint = `/api/assets/${asset.id}`;
      } else if (asset.category === "image") {
        endpoint = `/api/image-generations/${asset.id}`;
      } else {
        if (asset.generationMode === "WATERMARK_REMOVAL") {
          endpoint = `/api/videos/${asset.id}`;
        } else if (asset.generationMode === "UPSCALING") {
          endpoint = `/api/video-upscaler/${asset.id}`;
        } else {
          endpoint = `/api/generations/${asset.id}`;
        }
      }

      try {
        setDeletingAssetId(asset.id);
        const res = await authFetch(endpoint, { method: "DELETE" });
        const json = await res.json().catch(() => null);
        if (!res.ok || (json && json.success === false)) {
          throw new Error(json?.error || "Failed to delete asset");
        }

        if (selectedAsset?.id === asset.id) {
          setSelectedAsset(null);
        }
        await queryClient.invalidateQueries({ queryKey: ["assets"] });
        toast.success("Asset deleted");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete asset",
        );
      } finally {
        setDeletingAssetId(null);
      }
    },
    [authFetch, queryClient, selectedAsset?.id],
  );

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || isUploading) return;
      const fileArray = Array.from(files);
      setIsUploading(true);

      let successCount = 0;
      let failCount = 0;

      for (const file of fileArray) {
        try {
          const uploaded = await uploadFileToStorage(file);
          if (!uploaded.success || !uploaded.blobUrl) {
            throw new Error(uploaded.error || "Upload failed");
          }

          const registerRes = await authFetch("/api/assets", {
            method: "POST",
            body: JSON.stringify({
              name: file.name,
              url: uploaded.blobUrl,
              mimeType: file.type,
              type: getAssetType(file.type),
              fileSize: file.size,
            }),
          });

          if (!registerRes.ok) throw new Error("Failed to register file");
          successCount += 1;
        } catch {
          failCount += 1;
        }
      }

      await queryClient.invalidateQueries({ queryKey: assetQueryKeys.all });
      if (successCount > 0) {
        toast.success(
          `${successCount} file${successCount > 1 ? "s" : ""} uploaded successfully`,
        );
      }
      if (failCount > 0) {
        toast.error(
          `${failCount} file${failCount > 1 ? "s" : ""} failed to upload`,
        );
      }

      setIsUploading(false);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }
    },
    [authFetch, isUploading, queryClient],
  );

  const handleUploadZoneDrop = useCallback(
    (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setIsDragOverUploadZone(false);
      void handleUploadFiles(event.dataTransfer.files);
    },
    [handleUploadFiles],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 px-5 py-4">
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setTab("generated")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
                activeTab === "generated"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Generated
            </button>
            <button
              onClick={() => setTab("uploads")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
                activeTab === "uploads"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Uploads
            </button>
          </div>

          {activeTab === "generated" && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {FILTER_GROUPS.map((group) => (
                  <button
                    key={group.value}
                    onClick={() => setGeneratedFilter(group.value, "all")}
                    className={`rounded-full px-3 py-1 text-xs transition-colors sm:text-sm ${
                      activeGroup === group.value
                        ? "bg-primary/15 text-foreground"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {group.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {GROUP_FEATURES[activeGroup].map((feature) => (
                  <button
                    key={`${activeGroup}-${feature.value}`}
                    onClick={() =>
                      setGeneratedFilter(activeGroup, feature.value)
                    }
                    className={`rounded-full px-3 py-1 text-[11px] transition-colors sm:text-xs ${
                      activeFeature === feature.value
                        ? "bg-primary/20 text-foreground"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {feature.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {Array.from({ length: 18 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
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
                {activeTab === "uploads"
                  ? "No uploads found yet"
                  : `No assets found for ${FILTER_BADGE_LABEL(activeGroup, featureConfig.label)}`}
              </p>
            </div>
          </div>
        ) : activeTab === "uploads" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {/* <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              disabled={isUploading}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragOverUploadZone(true);
              }}
              onDragLeave={() => setIsDragOverUploadZone(false)}
              onDrop={handleUploadZoneDrop}
              className={`group flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/40 p-4 text-center transition-colors ${
                isDragOverUploadZone
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted"
              } ${isUploading ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-background/80 text-muted-foreground transition-colors group-hover:text-foreground">
                <UploadSimple className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isUploading ? "Uploading..." : "Upload files"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Images, videos, audio
                </p>
              </div>
            </button> */}
            {assets.map((asset) => (
              <AssetCard
                key={`${asset.category}-${asset.id}`}
                asset={asset}
                onClick={() => setSelectedAsset(asset)}
                displayMode="gallery"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {groupedAssets.map((group) => (
              <section key={group.id}>
                <div className="mb-3 flex items-center gap-3">
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:text-sm">
                    {group.label}
                  </h3>
                  <div className="h-px flex-1 bg-border/60" />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {group.items.map((asset) => (
                    <AssetCard
                      key={`${asset.category}-${asset.id}`}
                      asset={asset}
                      onClick={() => setSelectedAsset(asset)}
                      displayMode="gallery"
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {!isLoading && totalPages > 1 && (
          <Pagination className="pt-6">
            <PaginationContent className="flex-wrap justify-center">
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => goToPage(page - 1)}
                  className={
                    page <= 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>

              {page > 2 && (
                <PaginationItem>
                  <PaginationLink
                    onClick={() => goToPage(1)}
                    className="cursor-pointer"
                  >
                    1
                  </PaginationLink>
                </PaginationItem>
              )}

              {page > 3 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}

              {page > 1 && (
                <PaginationItem>
                  <PaginationLink
                    onClick={() => goToPage(page - 1)}
                    className="cursor-pointer"
                  >
                    {page - 1}
                  </PaginationLink>
                </PaginationItem>
              )}

              <PaginationItem>
                <PaginationLink isActive className="cursor-default">
                  {page}
                </PaginationLink>
              </PaginationItem>

              {page < totalPages && (
                <PaginationItem>
                  <PaginationLink
                    onClick={() => goToPage(page + 1)}
                    className="cursor-pointer"
                  >
                    {page + 1}
                  </PaginationLink>
                </PaginationItem>
              )}

              {page < totalPages - 2 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}

              {page < totalPages - 1 && (
                <PaginationItem>
                  <PaginationLink
                    onClick={() => goToPage(totalPages)}
                    className="cursor-pointer"
                  >
                    {totalPages}
                  </PaginationLink>
                </PaginationItem>
              )}

              <PaginationItem>
                <PaginationNext
                  onClick={() => goToPage(page + 1)}
                  className={
                    page >= totalPages
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>

      <AssetDetailDialog
        asset={selectedAsset}
        open={selectedAsset !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedAsset(null);
        }}
        onDelete={(asset) => void deleteAsset(asset)}
        isDeleting={deletingAssetId !== null}
      />
    </div>
  );
}
