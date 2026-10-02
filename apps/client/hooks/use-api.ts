import { useCallback } from "react";
import { useAuthFetch } from "./use-auth-fetch";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function fallbackMessage(status: number) {
  if (status === 401) return "Your session expired. Sign in again.";
  if (status === 403) return "Your plan doesn't include this. Upgrade to continue.";
  if (status === 404) return "We couldn't find that. It may have been deleted.";
  if (status >= 500) return "Something went wrong on our side. Try again in a moment.";
  return "That didn't work. Try again.";
}

/**
 * JSON requests against the Unsora API. Resolves to `body.data` (or the
 * whole body when there is no `data`), and throws `ApiError` with the
 * server's message and code on failure.
 */
export function useApi() {
  const { authFetch } = useAuthFetch();

  return useCallback(
    async <T,>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> => {
      const { json, ...rest } = init ?? {};
      const response = await authFetch(path, {
        ...rest,
        body: json !== undefined ? JSON.stringify(json) : rest.body,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.success === false) {
        throw new ApiError(
          body?.error || fallbackMessage(response.status),
          response.status,
          body?.code,
        );
      }
      return (body && "data" in body ? body.data : body) as T;
    },
    [authFetch],
  );
}
