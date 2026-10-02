import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useApi } from "./use-api";
import type { PostType } from "@/lib/scheduler/formats";
import type { Pagination, Post, PostStatus } from "@/lib/scheduler/types";

export interface PostFilters {
  status?: PostStatus[];
  type?: PostType;
  accountId?: string;
  provider?: string;
  q?: string;
  from?: string;
  to?: string;
  sort?: "scheduled" | "created" | "published" | "updated";
  dir?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export const postQueryKeys = {
  all: ["posts"] as const,
  lists: () => [...postQueryKeys.all, "list"] as const,
  list: (filters: PostFilters) => [...postQueryKeys.lists(), filters] as const,
  detail: (id: string) => [...postQueryKeys.all, "detail", id] as const,
  counts: () => [...postQueryKeys.all, "counts"] as const,
};

function toSearch(filters: PostFilters) {
  const params = new URLSearchParams();
  if (filters.status?.length) params.set("status", filters.status.join(","));
  if (filters.type) params.set("type", filters.type);
  if (filters.accountId) params.set("accountId", filters.accountId);
  if (filters.provider) params.set("provider", filters.provider);
  if (filters.q) params.set("q", filters.q);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.dir) params.set("dir", filters.dir);
  params.set("page", String(filters.page ?? 1));
  params.set("limit", String(filters.limit ?? 20));
  return params.toString();
}

const hasInFlight = (posts: Post[] | undefined) =>
  posts?.some((post) => post.status === "PUBLISHING") ?? false;

export function usePosts(
  filters: PostFilters,
  options: { enabled?: boolean } = {},
) {
  const api = useApi();
  return useQuery({
    queryKey: postQueryKeys.list(filters),
    queryFn: () =>
      api<{ posts: Post[]; pagination: Pagination }>(
        `/api/posts?${toSearch(filters)}`,
      ),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    // Keep publishing posts fresh until they settle.
    refetchInterval: (query) => (hasInFlight(query.state.data?.posts) ? 5_000 : false),
  });
}

export function usePost(id: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: postQueryKeys.detail(id ?? ""),
    queryFn: () => api<Post>(`/api/posts/${id}`),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data?.status === "PUBLISHING" ? 4_000 : false,
  });
}

export function usePostCounts() {
  const api = useApi();
  return useQuery({
    queryKey: postQueryKeys.counts(),
    queryFn: () =>
      api<{ counts: Record<PostStatus, number>; total: number }>("/api/posts/counts"),
    staleTime: 15_000,
  });
}

export interface PostPayload {
  type: PostType;
  mainCaption: string;
  scheduledFor?: string | null;
  timezone?: string | null;
  media?: {
    type: "VIDEO" | "IMAGE" | "THUMBNAIL";
    url: string;
    order: number;
    width?: number;
    height?: number;
    duration?: number;
    fileSize?: number;
    mimeType?: string;
  }[];
  accounts?: {
    accountId: string;
    customCaption?: string | null;
    title?: string | null;
    settings?: Record<string, unknown> | null;
  }[];
}

function useInvalidatePosts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: postQueryKeys.all });
}

export function useCreatePost() {
  const api = useApi();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (payload: PostPayload) =>
      api<Post>("/api/posts", { method: "POST", json: payload }),
    onSuccess: invalidate,
  });
}

export function usePublishNow() {
  const api = useApi();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (payload: PostPayload) =>
      api<Post>("/api/posts/publish-now", { method: "POST", json: payload }),
    onSuccess: invalidate,
  });
}

export function useUpdatePost() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<PostPayload> & { id: string }) =>
      api<Post>(`/api/posts/${id}`, { method: "PUT", json: payload }),
    onSuccess: (post) => {
      queryClient.setQueryData(postQueryKeys.detail(post.id), post);
      void queryClient.invalidateQueries({ queryKey: postQueryKeys.all });
    },
  });
}

/** Move a post to a new time (calendar drag, reschedule dialog). */
export function useReschedulePost() {
  const update = useUpdatePost();
  return {
    ...update,
    reschedule: (id: string, scheduledFor: Date, timezone: string) =>
      update.mutateAsync({ id, scheduledFor: scheduledFor.toISOString(), timezone }),
  };
}

export function usePublishPost() {
  const api = useApi();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ postId: string }>(`/api/posts/${id}/publish`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Publishing started");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useRetryPost() {
  const api = useApi();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ postId: string }>(`/api/posts/${id}/retry`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Retrying the accounts that failed");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDuplicatePost() {
  const api = useApi();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (id: string) =>
      api<Post>(`/api/posts/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Copied to a new draft");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeletePost() {
  const api = useApi();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (id: string) => api(`/api/posts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Post deleted");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useBulkDeletePosts() {
  const api = useApi();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api<{ count: number }>("/api/posts/bulk-delete", {
        method: "POST",
        json: { ids },
      }),
    onSuccess: (result) => {
      const count = result?.count ?? 0;
      toast.success(`${count} post${count === 1 ? "" : "s"} deleted`);
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
