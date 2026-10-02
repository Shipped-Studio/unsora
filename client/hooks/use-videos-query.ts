import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "./use-auth-fetch";

interface AssetRelation {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  type: string;
}

interface ProcessedVideo {
  id: string;
  originalName: string;
  originalAsset?: AssetRelation | null;
  processedAsset?: AssetRelation | null;
  operations: string[];
  creditsUsed: number;
  status: string;
  error?: string;
  durationSeconds?: number;
  fileSizeBytes?: bigint;
  upscaleModel?: string;
  watermarkRemovalModel?: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface VideosResponse {
  success: boolean;
  videos: ProcessedVideo[];
  pagination: PaginationInfo;
  error?: string;
}

interface VideoResponse {
  success: boolean;
  video: ProcessedVideo;
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

// Query keys
export const videoQueryKeys = {
  all: ["videos"] as const,
  lists: () => [...videoQueryKeys.all, "list"] as const,
  list: (page: number, limit: number) =>
    [...videoQueryKeys.lists(), { page, limit }] as const,
  details: () => [...videoQueryKeys.all, "detail"] as const,
  detail: (id: string) => [...videoQueryKeys.details(), id] as const,
};

// Custom hook for fetching paginated videos
export function useVideos(page: number = 1, limit: number = 20) {
  const { authFetch } = useAuthFetch();

  return useQuery({
    queryKey: videoQueryKeys.list(page, limit),
    queryFn: async (): Promise<VideosResponse> => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await authFetch(`/api/videos/all?${params}`);
      const data: VideosResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch videos");
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch videos");
      }

      return data;
    },
    staleTime: 10 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data?.videos) return false;
      const hasInProgress = data.videos.some(
        (v) =>
          v.status.toLowerCase() === "queued" ||
          v.status.toLowerCase() === "processing",
      );
      return hasInProgress ? 8000 : false;
    },
  });
}

// Custom hook for fetching a single video
export function useVideo(videoId: string) {
  const { authFetch } = useAuthFetch();

  return useQuery({
    queryKey: videoQueryKeys.detail(videoId),
    queryFn: async (): Promise<VideoResponse> => {
      const response = await authFetch(`/api/videos/${videoId}/status`);
      const data: VideoResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch video");
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch video");
      }

      return data;
    },
    enabled: !!videoId,
    staleTime: 10 * 1000, // 10 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Custom hook for deleting a single video
export function useDeleteVideo() {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (videoId: string): Promise<DeleteResponse> => {
      const response = await authFetch(`/api/videos/${videoId}`, {
        method: "DELETE",
      });
      const data: DeleteResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete video");
      }

      return data;
    },
    onSuccess: (data, videoId) => {
      // Invalidate and refetch videos list queries
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.lists() });

      // Remove the specific video from cache
      queryClient.removeQueries({ queryKey: videoQueryKeys.detail(videoId) });

      // Optimistically update the cache by removing the video from all list queries
      queryClient.setQueriesData(
        { queryKey: videoQueryKeys.lists() },
        (oldData: VideosResponse | undefined) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            videos: oldData.videos.filter((video) => video.id !== videoId),
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

// Custom hook for bulk deleting videos
export function useBulkDeleteVideos() {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (videoIds: string[]): Promise<BulkDeleteResponse> => {
      const response = await authFetch("/api/videos", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoIds }),
      });
      const data: BulkDeleteResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete videos");
      }

      return data;
    },
    onSuccess: (data, videoIds) => {
      // Invalidate and refetch videos list queries
      queryClient.invalidateQueries({ queryKey: videoQueryKeys.lists() });

      // Remove the specific videos from cache
      videoIds.forEach((videoId) => {
        queryClient.removeQueries({ queryKey: videoQueryKeys.detail(videoId) });
      });

      // Optimistically update the cache by removing the videos from all list queries
      queryClient.setQueriesData(
        { queryKey: videoQueryKeys.lists() },
        (oldData: VideosResponse | undefined) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            videos: oldData.videos.filter(
              (video) => !videoIds.includes(video.id)
            ),
            pagination: {
              ...oldData.pagination,
              totalCount: Math.max(
                0,
                oldData.pagination.totalCount - data.count
              ),
            },
          };
        }
      );
    },
  });
}

// Custom hook for refreshing video status
export function useRefreshVideoStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (videoId: string): Promise<VideoResponse> => {
      // This will refetch the video data
      return queryClient.fetchQuery({
        queryKey: videoQueryKeys.detail(videoId),
      });
    },
    onSuccess: (data, videoId) => {
      // Update the video in all list queries
      queryClient.setQueriesData(
        { queryKey: videoQueryKeys.lists() },
        (oldData: VideosResponse | undefined) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            videos: oldData.videos.map((video) =>
              video.id === videoId ? data.video : video
            ),
          };
        }
      );
    },
  });
}

export type { ProcessedVideo, PaginationInfo, VideosResponse };
