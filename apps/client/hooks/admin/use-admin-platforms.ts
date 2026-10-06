"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "../use-auth-fetch";
import { useIsAdmin } from "./use-admin-data";

export interface AdminPlatform {
  id: string;
  name: string;
  /** The admin switch. */
  switchedOn: boolean;
  /** Env vars the server still needs before this platform can work. */
  missingCredentials: string[];
  /** On and configured: users can connect and post. */
  live: boolean;
}

export interface AdminPlatformsData {
  /** Where the switches come from until an admin saves them here. */
  source: "admin" | "env" | "default";
  platforms: AdminPlatform[];
}

const KEY = ["admin", "platforms"] as const;

async function readJson(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json.data as AdminPlatformsData;
}

export function useAdminPlatforms() {
  const { authFetch } = useAuthFetch();
  const { isAdmin } = useIsAdmin();
  return useQuery({
    queryKey: KEY,
    queryFn: async () => readJson(await authFetch("/api/admin/platforms")),
    enabled: isAdmin,
    staleTime: 15_000,
  });
}

export function useSavePlatforms() {
  const { authFetch } = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: string[]) =>
      readJson(
        await authFetch("/api/admin/platforms", {
          method: "PUT",
          body: JSON.stringify({ enabled }),
        }),
      ),
    onSuccess: (data) => {
      qc.setQueryData(KEY, data);
      // The connect grid and composer read the public list.
      void qc.invalidateQueries({ queryKey: ["connected-accounts", "platforms"] });
    },
  });
}
