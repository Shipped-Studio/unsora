"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { useAuthFetch } from "../use-auth-fetch";
import { useUserUsage } from "../use-user-usage";
import type {
  OverviewData,
  AdminUsersResponse,
  AdminUserDetail,
  AdminTasksResponse,
  AdminTaskDetail,
  AdminContentResponse,
  AdminAnalyticsData,
} from "./types";

/** Whether the signed-in user may access /admin (server-computed flag). */
export function useIsAdmin() {
  const { usage, loading } = useUserUsage();
  return { isAdmin: usage?.user?.isAdmin === true, loading };
}

/** Shared fetcher: throws on non-ok / { success:false }. */
function useAdminGet() {
  const { authFetch } = useAuthFetch();
  return async <T>(path: string): Promise<T> => {
    const res = await authFetch(path);
    if (!res.ok) {
      if (res.status === 403) throw new Error("Forbidden");
      throw new Error(`Request failed (${res.status})`);
    }
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Request failed");
    return json.data as T;
  };
}

const qk = {
  overview: (days: number) => ["admin", "overview", days] as const,
  users: (params: string) => ["admin", "users", params] as const,
  user: (id: string) => ["admin", "user", id] as const,
  tasks: (params: string) => ["admin", "tasks", params] as const,
  task: (kind: string, id: string) => ["admin", "task", kind, id] as const,
  content: (params: string) => ["admin", "content", params] as const,
  analytics: (days: number) => ["admin", "analytics", days] as const,
};

export function useAdminOverview(days = 30) {
  const get = useAdminGet();
  const { isAdmin } = useIsAdmin();
  return useQuery({
    queryKey: qk.overview(days),
    queryFn: () => get<OverviewData>(`/api/admin/overview?days=${days}`),
    enabled: isAdmin,
    staleTime: 30_000,
  });
}

export interface UsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  plan?: string;
  status?: string;
  role?: string;
  active?: string;
  sort?: string;
  order?: string;
}

export function useAdminUsers(params: UsersQuery) {
  const get = useAdminGet();
  const { isAdmin } = useIsAdmin();
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ""),
  ).toString();
  return useQuery({
    queryKey: qk.users(qs),
    queryFn: () => get<AdminUsersResponse>(`/api/admin/users?${qs}`),
    enabled: isAdmin,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useAdminUser(id: string | null) {
  const get = useAdminGet();
  const { isAdmin } = useIsAdmin();
  return useQuery({
    queryKey: qk.user(id ?? ""),
    queryFn: () => get<AdminUserDetail>(`/api/admin/users/${id}`),
    enabled: isAdmin && !!id,
    staleTime: 15_000,
  });
}

export function useUpdateAdminUser(id: string) {
  const { authFetch } = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await authFetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Update failed");
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.user(id) });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useAdjustCredits(id: string) {
  const { authFetch } = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { delta: number; reason?: string }) => {
      const res = await authFetch(`/api/admin/users/${id}/credits`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Adjust failed");
      return json.data as { credits: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.user(id) });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export interface TasksQuery {
  page?: number;
  limit?: number;
  kind?: string;
  status?: string;
  userId?: string;
  search?: string;
}

export function useAdminTasks(params: TasksQuery) {
  const get = useAdminGet();
  const { isAdmin } = useIsAdmin();
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ""),
  ).toString();
  return useQuery({
    queryKey: qk.tasks(qs),
    queryFn: () => get<AdminTasksResponse>(`/api/admin/tasks?${qs}`),
    enabled: isAdmin,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

/** Full detail (output media, prompt, params, error) for one task. */
export function useAdminTaskDetail(
  kind: string | null,
  id: string | null,
  enabled = true,
) {
  const get = useAdminGet();
  const { isAdmin } = useIsAdmin();
  return useQuery({
    queryKey: qk.task(kind ?? "", id ?? ""),
    queryFn: () =>
      get<AdminTaskDetail>(`/api/admin/tasks/${kind}/${id}`),
    enabled: isAdmin && enabled && !!kind && !!id,
    staleTime: 30_000,
  });
}

export interface ContentQuery {
  page?: number;
  limit?: number;
  type?: string;
  source?: string;
  userId?: string;
}

export function useAdminContent(params: ContentQuery) {
  const get = useAdminGet();
  const { isAdmin } = useIsAdmin();
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ""),
  ).toString();
  return useQuery({
    queryKey: qk.content(qs),
    queryFn: () => get<AdminContentResponse>(`/api/admin/content?${qs}`),
    enabled: isAdmin,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useAdminAnalytics(days = 30) {
  const get = useAdminGet();
  const { isAdmin } = useIsAdmin();
  return useQuery({
    queryKey: qk.analytics(days),
    queryFn: () => get<AdminAnalyticsData>(`/api/admin/analytics?days=${days}`),
    enabled: isAdmin,
    staleTime: 30_000,
  });
}
