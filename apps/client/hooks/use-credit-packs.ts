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

/**
 * One-time credit top-up packs. The server is the source of truth for
 * pricing; never inline these values on the client.
 */
export function useCreditPacks() {
  const { authFetch } = useAuthFetch();
  const { isSignedIn } = useUser();

  const query = useQuery({
    queryKey: creditPacksQueryKeys.list(),
    queryFn: async (): Promise<CreditPack[]> => {
      const res = await authFetch("/api/stripe/credit-packs");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Couldn't load credit packs.");
      }
      return data.data as CreditPack[];
    },
    enabled: !!isSignedIn,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    packs: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
