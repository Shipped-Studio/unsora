import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApi } from "./use-api";

export interface Metrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

export interface AnalyticsPost {
  postAccountId: string;
  platform: string;
  accountUsername: string | null;
  profilePicture?: string | null;
  caption: string;
  postType: string;
  publishedAt: string | null;
  publishedUrl: string | null;
  metrics: Metrics;
  lastFetchedAt: string | null;
}

export interface AnalyticsSummary {
  days: number;
  totals: Metrics;
  postCount: number;
  byPlatform: (Metrics & { platform: string; posts: number })[];
  timeseries: { date: string; views: number; likes: number; comments: number; shares: number }[];
  posts: AnalyticsPost[];
}

export const analyticsQueryKeys = {
  all: ["analytics"] as const,
  summary: (days: number) => [...analyticsQueryKeys.all, "summary", days] as const,
};

export function useAnalyticsSummary(days: number, options: { enabled?: boolean } = {}) {
  const api = useApi();
  return useQuery({
    queryKey: analyticsQueryKeys.summary(days),
    queryFn: () => api<AnalyticsSummary>(`/api/posts/analytics/summary?days=${days}`),
    enabled: options.enabled ?? true,
    staleTime: 5 * 60_000,
  });
}

export function useRefreshAnalytics() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ refreshed: number }>("/api/posts/analytics/refresh", { method: "POST" }),
    onSuccess: (result) => {
      toast.success(
        result?.refreshed
          ? `Updated stats for ${result.refreshed} post${result.refreshed === 1 ? "" : "s"}`
          : "Stats are up to date",
      );
      void queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.all });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
