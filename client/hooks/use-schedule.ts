import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./use-api";
import { useUserUsage, userUsageQueryKeys } from "./use-user-usage";
import { getBrowserTimezone } from "@/lib/timezone";

export interface PostingSlot {
  id?: string;
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number;
  /** "HH:mm" */
  time: string;
}

export const scheduleQueryKeys = {
  all: ["schedule"] as const,
  slots: () => [...scheduleQueryKeys.all, "slots"] as const,
  next: (timezone: string, exclude?: string) =>
    [...scheduleQueryKeys.all, "next", timezone, exclude ?? ""] as const,
};

/** The zone the user schedules in: their saved preference, else the browser's. */
export function useSchedulerTimezone() {
  const { usage } = useUserUsage();
  return usage?.preferences?.timezone || getBrowserTimezone();
}

export function useWeekStartsOn(): 0 | 1 {
  const { usage } = useUserUsage();
  return usage?.preferences?.weekStartsOn === 0 ? 0 : 1;
}

export function usePostingSlots() {
  const api = useApi();
  return useQuery({
    queryKey: scheduleQueryKeys.slots(),
    queryFn: () =>
      api<{ timezone: string | null; weekStartsOn: number; slots: PostingSlot[] }>(
        "/api/schedule/slots",
      ),
  });
}

export function useSavePostingSlots() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { slots: PostingSlot[]; timezone?: string }) =>
      api("/api/schedule/slots", {
        method: "PUT",
        json: {
          timezone: input.timezone,
          slots: input.slots.map(({ weekday, time }) => ({ weekday, time })),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: userUsageQueryKeys.all });
    },
  });
}

/** The next free queue slots, as ISO strings. */
export function useNextSlots(options: {
  timezone: string;
  count?: number;
  excludePostId?: string;
  enabled?: boolean;
}) {
  const api = useApi();
  const params = new URLSearchParams({
    timezone: options.timezone,
    count: String(options.count ?? 5),
  });
  if (options.excludePostId) params.set("exclude", options.excludePostId);
  return useQuery({
    queryKey: scheduleQueryKeys.next(options.timezone, options.excludePostId),
    queryFn: () =>
      api<{ timezone: string; slots: string[] }>(
        `/api/schedule/next-slots?${params.toString()}`,
      ),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useUpdatePreferences() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { timezone?: string | null; weekStartsOn?: number }) =>
      api("/api/user/preferences", { method: "PATCH", json: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userUsageQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all });
    },
  });
}
