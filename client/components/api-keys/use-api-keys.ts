"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { useAuthFetch } from "@/hooks/use-auth-fetch";

/** Mirrors server/src/controllers/api-key.controller.ts. */
export interface ApiKey {
  id: string;
  name: string | null;
  /** First characters of the key, e.g. "uns_3Zx". */
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreatedApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  /** The full secret. Returned once, at creation. */
  key: string;
}

export const MAX_API_KEYS = 10;

export const apiKeyQueryKeys = {
  all: ["api-keys"] as const,
  list: () => [...apiKeyQueryKeys.all, "list"] as const,
};

async function readError(res: Response, fallback: string) {
  const body = await res.json().catch(() => null);
  return {
    message: (body && typeof body.error === "string" && body.error) || fallback,
    code: body && typeof body.code === "string" ? (body.code as string) : null,
  };
}

export class ApiKeyError extends Error {
  code: string | null;
  constructor(message: string, code: string | null) {
    super(message);
    this.code = code;
  }
}

export function useApiKeys() {
  const { authFetch } = useAuthFetch();
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: apiKeyQueryKeys.list(),
    queryFn: async (): Promise<ApiKey[]> => {
      const res = await authFetch("/api/user/api-keys");
      if (!res.ok) {
        const { message } = await readError(res, "Couldn't load your API keys.");
        throw new Error(message);
      }
      const json = await res.json();
      const keys = (json.data ?? []) as ApiKey[];
      return keys
        .slice()
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    },
    enabled: !!isSignedIn,
    staleTime: 30 * 1000,
  });
}

export function useCreateApiKey() {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string): Promise<CreatedApiKey> => {
      const res = await authFetch("/api/user/api-keys", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const { message, code } = await readError(
          res,
          "The server didn't respond.",
        );
        throw new ApiKeyError(message, code);
      }
      const json = await res.json();
      return json.data as CreatedApiKey;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: apiKeyQueryKeys.all }),
  });
}

export function useRevokeApiKey() {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(
        `/api/user/api-keys/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const { message } = await readError(res, "The server didn't respond.");
        throw new Error(message);
      }
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<ApiKey[]>(apiKeyQueryKeys.list(), (prev) =>
        prev?.filter((key) => key.id !== id),
      );
      return queryClient.invalidateQueries({ queryKey: apiKeyQueryKeys.all });
    },
  });
}
