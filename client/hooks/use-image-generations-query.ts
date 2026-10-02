import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "./use-auth-fetch";

interface AssetRelation {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  type: string;
}

interface ImageGenerationRefAsset {
  id: string;
  order: number;
  asset: AssetRelation;
}

export interface ImageGenerationRecord {
  id: string;
  prompt: string;
  model: string;
  status: string;
  outputAsset?: AssetRelation | null;
  thumbnailAsset?: AssetRelation | null;
  referenceAssets?: ImageGenerationRefAsset[];
  error?: string | null;
  ratio: string;
  resolution?: string;
  createdAt: string;
}

export interface ImageGenerationPaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface ImageGenerationsResponse {
  success: boolean;
  generations: ImageGenerationRecord[];
  pagination: ImageGenerationPaginationInfo;
  error?: string;
}

interface DeleteResponse {
  success: boolean;
  message: string;
  error?: string;
}

export const imageGenerationQueryKeys = {
  all: ["image-generations"] as const,
  lists: () => [...imageGenerationQueryKeys.all, "list"] as const,
  list: (page: number, limit: number) =>
    [...imageGenerationQueryKeys.lists(), { page, limit }] as const,
};

export function useImageGenerations(page: number = 1, limit: number = 12) {
  const { authFetch } = useAuthFetch();

  return useQuery({
    queryKey: imageGenerationQueryKeys.list(page, limit),
    queryFn: async (): Promise<ImageGenerationsResponse> => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await authFetch(
        `/api/image-generations/all?${params}`,
      );
      const data: ImageGenerationsResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch image generations");
      }

      return data;
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useDeleteImageGeneration() {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (generationId: string): Promise<DeleteResponse> => {
      const response = await authFetch(
        `/api/image-generations/${generationId}`,
        { method: "DELETE" },
      );
      const data: DeleteResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete generation");
      }

      return data;
    },
    onSuccess: (_data, generationId) => {
      queryClient.invalidateQueries({
        queryKey: imageGenerationQueryKeys.lists(),
      });

      queryClient.setQueriesData(
        { queryKey: imageGenerationQueryKeys.lists() },
        (oldData: ImageGenerationsResponse | undefined) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            generations: oldData.generations.filter(
              (g) => g.id !== generationId,
            ),
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

export type { ImageGenerationsResponse };
