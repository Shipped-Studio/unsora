import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "./use-auth-fetch";

interface AssetRelation {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  type: string;
}

export interface ImageUpscaleRecord {
  id: string;
  status: string;
  inputAsset?: AssetRelation | null;
  outputAsset?: AssetRelation | null;
  thumbnailAsset?: AssetRelation | null;
  error?: string | null;
  originalName?: string;
  createdAt: string;
}

export interface ImageUpscalePaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface ImageUpscalesResponse {
  success: boolean;
  jobs: ImageUpscaleRecord[];
  pagination: ImageUpscalePaginationInfo;
  error?: string;
}

interface DeleteResponse {
  success: boolean;
  message: string;
  error?: string;
}

export const imageUpscaleQueryKeys = {
  all: ["image-upscales"] as const,
  lists: () => [...imageUpscaleQueryKeys.all, "list"] as const,
  list: (page: number, limit: number) =>
    [...imageUpscaleQueryKeys.lists(), { page, limit }] as const,
};

export function useImageUpscales(page: number = 1, limit: number = 12) {
  const { authFetch } = useAuthFetch();

  return useQuery({
    queryKey: imageUpscaleQueryKeys.list(page, limit),
    queryFn: async (): Promise<ImageUpscalesResponse> => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await authFetch(`/api/image-upscaler/all?${params}`);
      const data: ImageUpscalesResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch upscaled images");
      }

      return data;
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useDeleteImageUpscale() {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string): Promise<DeleteResponse> => {
      const response = await authFetch(`/api/image-upscaler/${jobId}`, {
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
        queryKey: imageUpscaleQueryKeys.lists(),
      });

      queryClient.setQueriesData(
        { queryKey: imageUpscaleQueryKeys.lists() },
        (oldData: ImageUpscalesResponse | undefined) => {
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

export type { ImageUpscalesResponse };
