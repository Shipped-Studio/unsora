import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "./use-auth-fetch";

interface AssetRelation {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  type: string;
}

export interface VideoUpscaleRecord {
  id: string;
  originalName: string;
  originalAsset?: AssetRelation | null;
  processedAsset?: AssetRelation | null;
  operations: string[];
  creditsUsed: number;
  status: string;
  error?: string | null;
  upscaleModel?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoUpscalePaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface VideoUpscalesResponse {
  success: boolean;
  jobs: VideoUpscaleRecord[];
  pagination: VideoUpscalePaginationInfo;
  error?: string;
}

interface DeleteResponse {
  success: boolean;
  message: string;
  error?: string;
}

interface BulkDeleteResponse {
  success: boolean;
  message: string;
  count: number;
  error?: string;
}

export const videoUpscaleQueryKeys = {
  all: ["video-upscales"] as const,
  lists: () => [...videoUpscaleQueryKeys.all, "list"] as const,
  list: (page: number, limit: number) =>
    [...videoUpscaleQueryKeys.lists(), { page, limit }] as const,
};

export function useVideoUpscales(page: number = 1, limit: number = 12) {
  const { authFetch } = useAuthFetch();

  return useQuery({
    queryKey: videoUpscaleQueryKeys.list(page, limit),
    queryFn: async (): Promise<VideoUpscalesResponse> => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await authFetch(`/api/video-upscaler/all?${params}`);
      const data: VideoUpscalesResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch video upscales");
      }

      return data;
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useDeleteVideoUpscale() {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string): Promise<DeleteResponse> => {
      const response = await authFetch(`/api/video-upscaler/${jobId}`, {
        method: "DELETE",
      });
      const data: DeleteResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete upscale");
      }

      return data;
    },
    onSuccess: (_data, jobId) => {
      queryClient.invalidateQueries({
        queryKey: videoUpscaleQueryKeys.lists(),
      });

      queryClient.setQueriesData(
        { queryKey: videoUpscaleQueryKeys.lists() },
        (oldData: VideoUpscalesResponse | undefined) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            jobs: oldData.jobs.filter((j) => j.id !== jobId),
            pagination: {
              ...oldData.pagination,
              totalCount: Math.max(0, oldData.pagination.totalCount - 1),
            },
          };
        },
      );
    },
  });
}

export function useBulkDeleteVideoUpscales() {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobIds: string[]): Promise<BulkDeleteResponse> => {
      const response = await authFetch("/api/video-upscaler/", {
        method: "DELETE",
        body: JSON.stringify({ jobIds }),
      });
      const data: BulkDeleteResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete upscales");
      }

      return data;
    },
    onSuccess: (data, jobIds) => {
      queryClient.invalidateQueries({
        queryKey: videoUpscaleQueryKeys.lists(),
      });

      queryClient.setQueriesData(
        { queryKey: videoUpscaleQueryKeys.lists() },
        (oldData: VideoUpscalesResponse | undefined) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            jobs: oldData.jobs.filter((j) => !jobIds.includes(j.id)),
            pagination: {
              ...oldData.pagination,
              totalCount: Math.max(
                0,
                oldData.pagination.totalCount - data.count,
              ),
            },
          };
        },
      );
    },
  });
}

export type { VideoUpscalesResponse };
