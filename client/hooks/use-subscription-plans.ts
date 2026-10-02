import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { useAuthFetch } from "./use-auth-fetch";

export interface SubscriptionPlan {
  key: string;
  name: string;
  description?: string;
  credits: number;
  priceUsd: number;
  isPopular?: boolean;
  sortOrder: number;
}

export const subscriptionPlansQueryKeys = {
  all: ["subscription-plans"] as const,
  list: () => [...subscriptionPlansQueryKeys.all, "list"] as const,
};

/**
 * Fetches the subscription tier catalog (basic / pro / power) from the server.
 * The DB `plans` table is the single source of truth for names, prices, and
 * credits — never inline these on the client, or the card can advertise a
 * different amount than the webhook actually grants. Checkout is driven by the
 * plan `key`, so the price ID never reaches the browser.
 */
export function useSubscriptionPlans() {
  const { authFetch } = useAuthFetch();
  const { isSignedIn } = useUser();

  const query = useQuery({
    queryKey: subscriptionPlansQueryKeys.list(),
    queryFn: async (): Promise<SubscriptionPlan[]> => {
      const res = await authFetch("/api/stripe/subscription-plans");
      if (!res.ok) throw new Error("Failed to load subscription plans");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load");
      return data.data as SubscriptionPlan[];
    },
    enabled: !!isSignedIn,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    plans: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
  };
}
