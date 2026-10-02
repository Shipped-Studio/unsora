import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "./use-auth-fetch";

interface AssetRelation {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  type: string;
}

interface GenerationInputAsset {
  id: string;
  role: string;
  order: number;
  asset: AssetRelation;
}

export interface Generation {
  id: string;
  prompt: string;
  model: string;
  functionMode: string;
  status: string;
  outputAsset?: AssetRelation | null;
  thumbnailAsset?: AssetRelation | null;
  imageAsset?: AssetRelation | null;
  endImageAsset?: AssetRelation | null;
  inputAssets?: GenerationInputAsset[];
  error?: string | null;
  duration: number;
  ratio: string;
  createdAt: string;
}

export interface GenerationPaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface GenerationsResponse {
  success: boolean;
  generations: Generation[];
  pagination: GenerationPaginationInfo;
  error?: string;
}

interface DeleteGenerationResponse {
  success: boolean;
  message: string;
  error?: string;
}

interface BulkDeleteGenerationsResponse {
  success: boolean;
  message: string;
  count: number;
  error?: string;
}

export const generationQueryKeys = {
  all: ["generations"] as const,
  lists: () => [...generationQueryKeys.all, "list"] as const,
  list: (page: number, limit: number) =>
    [...generationQueryKeys.lists(), { page, limit }] as const,
};

export function useGenerations(page: number = 1, limit: number = 12) {
  const { authFetch } = useAuthFetch();

  return useQuery({
    queryKey: generationQueryKeys.list(page, limit),
    queryFn: async (): Promise<GenerationsResponse> => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await authFetch(`/api/v1/videos/all?${params}`);
      const data: GenerationsResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch generations");
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch generations");
      }

      return data;
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useDeleteGeneration() {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (generationId: string): Promise<DeleteGenerationResponse> => {
      const response = await authFetch(`/api/v1/videos/${generationId}`, {
        method: "DELETE",
      });
      const data: DeleteGenerationResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete generation");
      }

      return data;
    },
    onSuccess: (_data, generationId) => {
      queryClient.invalidateQueries({ queryKey: generationQueryKeys.lists() });

      queryClient.setQueriesData(
        { queryKey: generationQueryKeys.lists() },
        (oldData: GenerationsResponse | undefined) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            generations: oldData.generations.filter((g) => g.id !== generationId),
            pagination: {
              ...oldData.pagination,
              totalCount: Math.max(0, oldData.pagination.totalCount - 1),
            },
          };
        }
      );
    },
  });
}

export function useBulkDeleteGenerations() {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (generationIds: string[]): Promise<BulkDeleteGenerationsResponse> => {
      const response = await authFetch("/api/generations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationIds }),
      });
      const data: BulkDeleteGenerationsResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete generations");
      }

      return data;
    },
    onSuccess: (data, generationIds) => {
      queryClient.invalidateQueries({ queryKey: generationQueryKeys.lists() });

      queryClient.setQueriesData(
        { queryKey: generationQueryKeys.lists() },
        (oldData: GenerationsResponse | undefined) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            generations: oldData.generations.filter(
              (g) => !generationIds.includes(g.id)
            ),
            pagination: {
              ...oldData.pagination,
              totalCount: Math.max(0, oldData.pagination.totalCount - data.count),
            },
          };
        }
      );
    },
  });
}
