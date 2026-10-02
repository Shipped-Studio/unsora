import { useAuth } from "@clerk/nextjs";
import { useCallback, useRef } from "react";
import { toast } from "sonner";

export function useAuthFetch() {
  const { getToken } = useAuth();
  const hasPromptedRef = useRef(false);

  const authFetch = useCallback(
    async (path: string, options: RequestInit = {}): Promise<Response> => {
      const token = await getToken();
      if (!token) {
        return new Response(null, { status: 401, statusText: "Unauthorized" });
      }

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}${path}`,
        { ...options, headers },
      );
      if (response.status === 403) {
        const responseData = await response.json();
        if (responseData.limitReached && !hasPromptedRef.current) {
          hasPromptedRef.current = true;
          toast.error(
            "You have reached your monthly limit. Please upgrade your subscription to continue.",
          );
        }
      }
      return response;
    },
    [getToken],
  );

  const authFetchWithFormData = useCallback(
    async (
      path: string,
      formData: FormData,
      options: RequestInit = {},
    ): Promise<Response> => {
      const token = await getToken();
      if (!token) {
        return new Response(null, { status: 401, statusText: "Unauthorized" });
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}${path}`,
        { ...options, headers, body: formData },
      );
      return response;
    },
    [getToken],
  );

  return { authFetch, authFetchWithFormData };
}
