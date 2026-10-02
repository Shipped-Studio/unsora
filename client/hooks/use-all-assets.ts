import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useAuthFetch } from "./use-auth-fetch";

export type FilterTab = "uploaded" | "image" | "video";

export interface UnifiedAsset {
  id: string;
  category: FilterTab;
  mediaType: "video" | "image" | "audio" | "file";
  status: string;
  prompt?: string | null;
  name?: string | null;
  model?: string | null;
  outputUrl?: string | null;
  thumbnailUrl?: string | null;
  error?: string | null;
  createdAt: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
  generationMode?: string | null;
  imageGenerationType?: string | null;
}

export const FILTER_TABS: {
  value: FilterTab;
  label: string;
  mediaType: "video" | "image" | "any";
}[] = [
  { value: "video", label: "Videos", mediaType: "video" },
  { value: "image", label: "Images", mediaType: "image" },
  { value: "uploaded", label: "Uploads", mediaType: "any" },
];

const VALID_TABS = new Set<string>(FILTER_TABS.map((t) => t.value));

export function isValidTab(value: string | null): value is FilterTab {
  return value !== null && VALID_TABS.has(value);
}

export const assetQueryKeys = {
  all: ["assets"] as const,
  browse: (
    type: FilterTab,
    page: number,
    limit: number,
    feature?: string,
  ) => [...assetQueryKeys.all, "browse", type, { page, limit, feature }] as const,
};

export interface BrowseAssetsPagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface BrowseAssetsResponse {
  items: UnifiedAsset[];
  pagination: BrowseAssetsPagination;
}

interface UseAssetsByCategoryParams {
  category: FilterTab;
  page?: number;
  limit?: number;
  feature?: string;
}

export function useAssetsByCategory({
  category,
  page = 1,
  limit = 12,
  feature,
}: UseAssetsByCategoryParams) {
  const { authFetch } = useAuthFetch();

  return useQuery({
    queryKey: assetQueryKeys.browse(category, page, limit, feature),
    queryFn: async (): Promise<BrowseAssetsResponse> => {
      const params = new URLSearchParams({
        type: category,
        page: String(page),
        limit: String(limit),
      });
      if (feature) {
        params.set("feature", feature);
      }

      const res = await authFetch(`/api/assets/browse?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        return {
          items: [],
          pagination: {
            currentPage: page,
            totalPages: 1,
            totalCount: 0,
            limit,
            hasNextPage: false,
            hasPreviousPage: page > 1,
          },
        };
      }

      return {
        items: (json.items ?? []) as UnifiedAsset[],
        pagination: {
          currentPage: json.pagination?.currentPage ?? page,
          totalPages: json.pagination?.totalPages ?? 1,
          totalCount: json.pagination?.totalCount ?? 0,
          limit: json.pagination?.limit ?? limit,
          hasNextPage: json.pagination?.hasNextPage ?? false,
          hasPreviousPage: json.pagination?.hasPreviousPage ?? page > 1,
        },
      };
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

const PAGE_SIZE = 12;

export function useInfiniteAssetsByCategory(category: FilterTab) {
  const { authFetch } = useAuthFetch();

  const query = useInfiniteQuery({
    queryKey: [...assetQueryKeys.all, "infinite", category] as const,
    initialPageParam: 1,
    queryFn: async ({
      pageParam,
    }): Promise<{
      items: UnifiedAsset[];
      hasNextPage: boolean;
    }> => {
      const res = await authFetch(
        `/api/assets/browse?type=${category}&page=${pageParam}&limit=${PAGE_SIZE}`,
      );
      const json = await res.json();

      if (!json.success) return { items: [], hasNextPage: false };

      return {
        items: (json.items ?? []) as UnifiedAsset[],
        hasNextPage: json.pagination?.hasNextPage ?? false,
      };
    },
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasNextPage ? lastPageParam + 1 : undefined,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const assets = query.data?.pages.flatMap((p) => p.items) ?? [];

  return {
    assets,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
  };
}
