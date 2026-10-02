import { useQuery } from "@tanstack/react-query";
import { useAuthFetch } from "./use-auth-fetch";

export interface ConnectedAccount {
  id: string;
  provider: string;
  providerAccountId: string;
  accountName: string | null;
  accountUsername: string | null;
  profilePicture: string | null;
  expiresAt: string | null;
}

interface ConnectedAccountsResponse {
  success: boolean;
  data: ConnectedAccount[];
  error?: string;
}

export const connectedAccountsQueryKeys = {
  all: ["connected-accounts"] as const,
  list: () => [...connectedAccountsQueryKeys.all, "list"] as const,
};

export function useConnectedAccounts() {
  const { authFetch } = useAuthFetch();

  return useQuery({
    queryKey: connectedAccountsQueryKeys.list(),
    queryFn: async (): Promise<ConnectedAccount[]> => {
      const response = await authFetch("/api/connect/accounts");

      if (!response.ok) {
        throw new Error("Failed to fetch connected accounts");
      }

      const data: ConnectedAccountsResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch connected accounts");
      }

      return data.data || [];
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}
