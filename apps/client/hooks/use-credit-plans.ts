import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { useAuthFetch } from "./use-auth-fetch";
import type { PlanInterval } from "./use-subscription-plans";

/** A Monthly credits tier: credits every month that don't roll over. */
export interface CreditPlan {
  key: string;
  name: string;
  description?: string;
  /** Credits added each billing period. */
  credits: number;
  priceUsd: number;
  interval: PlanInterval;
  isPopular?: boolean;
  sortOrder: number;
}

export const creditPlansQueryKeys = {
  all: ["credit-plans"] as const,
  list: () => [...creditPlansQueryKeys.all, "list"] as const,
};

/**
 * Monthly credits tiers from the server (`plans` rows of type
 * CREDIT_SUBSCRIPTION). Checkout is driven by the `key`; the Stripe price
 * never reaches the browser.
 */
export function useCreditPlans() {
  const { authFetch } = useAuthFetch();
  const { isSignedIn } = useUser();

  const query = useQuery({
    queryKey: creditPlansQueryKeys.list(),
    queryFn: async (): Promise<CreditPlan[]> => {
      const res = await authFetch("/api/stripe/credit-plans");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Couldn't load monthly credit plans.");
      }
      return data.data as CreditPlan[];
    },
    enabled: !!isSignedIn,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    plans: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
