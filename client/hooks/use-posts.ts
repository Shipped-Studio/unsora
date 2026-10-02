import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "./use-auth-fetch";
import { toast } from "sonner";

interface AssetRelation {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  type: string;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  fileSize?: string | null;
}

export interface PostMedia {
  id: string;
  type: "VIDEO" | "IMAGE" | "THUMBNAIL";
  order: number;
  asset: AssetRelation;
}

export interface PostAccount {
  id: string;
  accountId: string;
  customCaption?: string | null;
  published: boolean;
  publishedAt?: string | null;
  publishedPostId?: string | null;
  publishedUrl?: string | null;
  error?: string | null;
  account: {
    id: string;
    provider: string;
    accountName: string | null;
    accountUsername: string | null;
    profilePicture: string | null;
  };
}

export interface Post {
  id: string;
  userId: string;
  type: "VIDEO" | "IMAGE" | "CAROUSEL" | "TEXT";
  mainCaption: string;
  status:
    | "DRAFT"
    | "SCHEDULED"
    | "PUBLISHING"
    | "PUBLISHED"
    | "PARTIALLY_PUBLISHED"
    | "FAILED";
  scheduledFor?: string | null;
  publishedAt?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  media: PostMedia[];
  postAccounts: PostAccount[];
}

export interface PostsResponse {
  success: boolean;
  data: {
    posts: Post[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
}

export const postsQueryKeys = {
  all: ["posts"] as const,
  lists: () => [...postsQueryKeys.all, "list"] as const,
  list: (filters: {
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) => [...postsQueryKeys.lists(), filters] as const,
  details: () => [...postsQueryKeys.all, "detail"] as const,
  detail: (id: string) => [...postsQueryKeys.details(), id] as const,
};

export function usePosts(
  filters: {
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  const { authFetch } = useAuthFetch();

  return useQuery({
    queryKey: postsQueryKeys.list(filters),
    queryFn: async (): Promise<PostsResponse["data"]> => {
      const params = new URLSearchParams();

      if (filters.status) params.append("status", filters.status);
      if (filters.type) params.append("type", filters.type);
      if (filters.page) params.append("page", filters.page.toString());
      if (filters.limit) params.append("limit", filters.limit.toString());

      const response = await authFetch(`/api/posts?${params.toString()}`);
      const data: PostsResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch posts");
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch posts");
      }

      return data.data;
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function usePost(postId: string) {
  const { authFetch } = useAuthFetch();

  return useQuery({
    queryKey: postsQueryKeys.detail(postId),
    queryFn: async (): Promise<Post> => {
      const response = await authFetch(`/api/posts/${postId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch post");
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch post");
      }

      return data.data;
    },
    enabled: !!postId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useDeletePost() {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const response = await authFetch(`/api/posts/${postId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete post");
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to delete post");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postsQueryKeys.all });
      toast.success("Post deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete post");
    },
  });
}

export function useRetryPost() {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const response = await authFetch(`/api/posts/${postId}/retry`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to retry post");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postsQueryKeys.all });
      toast.success("Post published successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to retry post");
    },
  });
}

export function useBulkDeletePosts() {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      postIds: string[]
    ): Promise<{ count: number; message: string }> => {
      const response = await authFetch("/api/posts/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids: postIds }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to delete posts");
      }

      return { count: data.count, message: data.message };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: postsQueryKeys.all });
      toast.success(data.message);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete posts");
    },
  });
}
