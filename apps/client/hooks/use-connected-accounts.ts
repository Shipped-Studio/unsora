import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApi } from "./use-api";
import { platformName } from "@/lib/scheduler/formats";
import type { ConnectedAccount } from "@/lib/scheduler/types";

export type { ConnectedAccount };

export const connectedAccountsQueryKeys = {
  all: ["connected-accounts"] as const,
  list: () => [...connectedAccountsQueryKeys.all, "list"] as const,
  pinterestBoards: (accountId: string) =>
    [...connectedAccountsQueryKeys.all, "pinterest-boards", accountId] as const,
};

export function useConnectedAccounts() {
  const api = useApi();
  return useQuery({
    queryKey: connectedAccountsQueryKeys.list(),
    queryFn: () => api<ConnectedAccount[]>("/api/connect/accounts"),
    staleTime: 60_000,
  });
}

/** Starts an OAuth connection and sends the browser to the platform. */
export function useConnectAccount() {
  const api = useApi();
  return useMutation({
    mutationFn: async ({
      provider,
      handle,
      reconnectAccountId,
    }: {
      provider: string;
      handle?: string;
      /** Set when re-authorizing an existing account, so it doesn't count as a new one against the plan limit. */
      reconnectAccountId?: string;
    }) => {
      const params = new URLSearchParams();
      if (handle) params.set("handle", handle);
      if (reconnectAccountId) params.set("reconnect", reconnectAccountId);
      const query = params.toString();
      const { authUrl } = await api<{ authUrl: string }>(
        `/api/connect/${provider}${query ? `?${query}` : ""}`,
      );
      if (!authUrl) throw new Error("Couldn't start the connection. Try again.");
      window.location.href = authUrl;
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * A connect link to send to someone else: whoever opens it can connect their
 * account to this workspace without an Unsora login. Valid for 1 hour.
 */
export function useShareConnectLink() {
  const api = useApi();
  return useMutation({
    mutationFn: async (provider: string) => {
      const { authUrl } = await api<{ authUrl: string }>(`/api/connect/${provider}?share=1`);
      if (!authUrl) throw new Error("Couldn't create the link. Try again.");
      return authUrl;
    },
  });
}

export function useRefreshAccount() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      api(`/api/connect/accounts/${accountId}/refresh`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Account refreshed");
      void queryClient.invalidateQueries({ queryKey: connectedAccountsQueryKeys.all });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDisconnectAccount() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (account: ConnectedAccount) =>
      api(`/api/connect/accounts/${account.id}`, { method: "DELETE" }),
    onSuccess: (_, account) => {
      toast.success(`${platformName(account.provider)} account disconnected`);
      void queryClient.invalidateQueries({ queryKey: connectedAccountsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export interface PinterestBoard {
  id: string;
  name: string;
  privacy?: string;
}

export function usePinterestBoards(accountId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: connectedAccountsQueryKeys.pinterestBoards(accountId ?? ""),
    queryFn: () => api<PinterestBoard[]>(`/api/connect/pinterest/${accountId}/boards`),
    enabled: Boolean(accountId),
    staleTime: 5 * 60_000,
  });
}
