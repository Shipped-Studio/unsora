import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "./use-auth-fetch";
import { useUser } from "@clerk/nextjs";

interface UserUsage {
  user: {
    id: string;
    clerkId: string;
    email: string;
    /** "USER" | "ADMIN". */
    role?: string;
    /** True when this account may access the /admin dashboard. */
    isAdmin?: boolean;
    plan: string;
    isActive: boolean;
    status: string | null;
    /**
     * `true` when the subscription is set to cancel at the end of the
     * current billing period (or has already been deleted). When combined
     * with `isActive === true` this means "still has access, but won't
     * renew" — the billing UI surfaces this as "Subscription Ending".
     */
    isCancelled: boolean;
    /** ISO timestamp of when the current paid period ends. */
    stripeCurrentPeriodEnd: string | null;
  };
  credits: number;
}

export const userUsageQueryKeys = {
  all: ["user-usage"] as const,
  usage: () => [...userUsageQueryKeys.all, "usage"] as const,
};

interface UseUserUsageOptions {
  /**
   * When set to a positive number, the query will refetch on this interval.
   * Use this to "follow" credit changes from async work (e.g. queue refunds
   * when a job fails). Pass `false` / `0` / `undefined` to disable polling
   * — the default. Recommended value while a generation is in flight: 10000.
   */
  pollIntervalMs?: number | false;
}

export function useUserUsage(options: UseUserUsageOptions = {}) {
  const { authFetch } = useAuthFetch();
  const { isSignedIn } = useUser();
  const { pollIntervalMs } = options;

  const query = useQuery({
    queryKey: userUsageQueryKeys.usage(),
    queryFn: async (): Promise<UserUsage> => {
      const response = await authFetch("/api/user/usage");

      if (!response.ok) {
        throw new Error("Failed to fetch user usage");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch user usage");
      }

      return data.data;
    },
    enabled: !!isSignedIn,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: pollIntervalMs && pollIntervalMs > 0 ? pollIntervalMs : false,
    refetchIntervalInBackground: false,
  });

  return {
    usage: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

/**
 * Returns a function that writes a new credit balance straight into the
 * React Query cache for `useUserUsage`. Use this immediately after a
 * mutation that returns `creditsRemaining` so the sidebar updates in the
 * same frame as the click — no extra request.
 *
 * @example
 *   const setCredits = useSetCreditBalance();
 *   const res = await fetch("/api/image/generate", { ... }).then(r => r.json());
 *   if (typeof res.creditsRemaining === "number") setCredits(res.creditsRemaining);
 */
export function useSetCreditBalance() {
  const queryClient = useQueryClient();

  return useCallback(
    (creditsRemaining: number) => {
      if (typeof creditsRemaining !== "number" || Number.isNaN(creditsRemaining)) {
        return;
      }
      queryClient.setQueryData<UserUsage>(
        userUsageQueryKeys.usage(),
        (prev) => {
          if (!prev) return prev;
          if (prev.credits === creditsRemaining) return prev;
          return { ...prev, credits: creditsRemaining };
        },
      );
    },
    [queryClient],
  );
}

export function usePrefetchUserUsage() {
  const queryClient = useQueryClient();
  const { authFetch } = useAuthFetch();

  const prefetch = async () => {
    await queryClient.prefetchQuery({
      queryKey: userUsageQueryKeys.usage(),
      queryFn: async (): Promise<UserUsage> => {
        const response = await authFetch("/api/user/usage");

        if (!response.ok) {
          throw new Error("Failed to fetch user usage");
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to fetch user usage");
        }

        return data.data;
      },
      staleTime: 60 * 1000,
    });
  };

  return { prefetch };
}
