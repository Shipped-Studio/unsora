import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { useAuthFetch } from "./use-auth-fetch";

export interface CreditPack {
  key: string;
  name: string;
  credits: number;
  priceUsd: number;
  description?: string;
  popular?: boolean;
}

export const creditPacksQueryKeys = {
  all: ["credit-packs"] as const,
  list: () => [...creditPacksQueryKeys.all, "list"] as const,
};

interface UseCreditPacksOptions {
  /**
   * Skip fetching when false (e.g. for free-tier users that aren't allowed
   * to buy top-ups anyway). Defaults to true so the hook stays drop-in.
   */
  enabled?: boolean;
}

/**
 * Fetches the catalog of one-time credit top-up packs from the server. The
 * server is the source of truth for pricing — never inline these values on
 * the client, or a tampered request could buy 5000 credits for $1.
 */
export function useCreditPacks(options: UseCreditPacksOptions = {}) {
  const { authFetch } = useAuthFetch();
  const { isSignedIn } = useUser();
  const { enabled = true } = options;

  const query = useQuery({
    queryKey: creditPacksQueryKeys.list(),
    queryFn: async (): Promise<CreditPack[]> => {
      const res = await authFetch("/api/stripe/credit-packs");
      if (!res.ok) throw new Error("Failed to load credit packs");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load");
      return data.data as CreditPack[];
    },
    enabled: !!isSignedIn && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    packs: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
  };
}
