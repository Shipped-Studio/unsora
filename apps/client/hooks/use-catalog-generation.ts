"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthFetch } from "./use-auth-fetch";
import {
  catalogQueryKeys,
  type CatalogCategory,
  type CatalogRequest,
} from "./use-model-catalog";

export type CatalogGenerationStatus =
  | "submitting"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface ActiveCatalogGeneration {
  id: string;
  status: CatalogGenerationStatus;
  error?: string;
  outputAsset?: { id: string; url: string } | null;
  thumbnailAsset?: { id: string; url: string } | null;
  prompt: string;
  model: string;
  createdAt: string;
}

export interface CatalogSubmit extends CatalogRequest {
  /** The price the user saw; the server refuses to charge more than this. */
  expectedCredits?: number;
}

const POLL_INTERVAL_MS = 4_000;

// Catalog generations land in each tool's existing table, so status polling
// reuses the tool's existing refresh endpoint.
const REFRESH_PATH: Record<CatalogCategory, (id: string) => string> = {
  video: (id) => `/api/video-generation/refresh/${id}`,
  "motion-control": (id) => `/api/motion-control/refresh/${id}`,
  image: (id) => `/api/image-generations/refresh/${id}`,
};

const NOUN: Record<CatalogCategory, string> = {
  video: "video",
  "motion-control": "video",
  image: "image",
};

/** Submit catalog generations and track them until they finish. */
export function useCatalogGeneration(
  category: CatalogCategory,
  options?: { onSettled?: (id: string) => void },
) {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();
  const noun = NOUN[category];
  const onSettledRef = useRef(options?.onSettled);
  useEffect(() => {
    onSettledRef.current = options?.onSettled;
  });

  const [activeGenerations, setActiveGenerations] = useState<
    ActiveCatalogGeneration[]
  >([]);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );

  const patch = useCallback(
    (id: string, next: Partial<ActiveCatalogGeneration>) =>
      setActiveGenerations((prev) =>
        prev.map((g) => (g.id === id ? { ...g, ...next } : g)),
      ),
    [],
  );

  const stopPolling = useCallback((id: string) => {
    const timer = pollTimers.current.get(id);
    if (timer) {
      clearInterval(timer);
      pollTimers.current.delete(id);
    }
  }, []);

  const pollStatus = useCallback(
    (id: string) => {
      if (pollTimers.current.has(id)) return;

      const timer = setInterval(async () => {
        try {
          const res = await authFetch(REFRESH_PATH[category](id));
          if (res.status === 404) {
            stopPolling(id);
            return;
          }
          if (!res.ok) return;

          const gen = (await res.json()).generation;
          if (!gen) return;

          patch(id, {
            status: gen.status,
            error: gen.error || undefined,
            outputAsset: gen.outputAsset || undefined,
            thumbnailAsset: gen.thumbnailAsset || undefined,
          });

          if (gen.status === "COMPLETED" || gen.status === "FAILED") {
            stopPolling(id);
            if (gen.status === "COMPLETED") {
              toast.success(`${noun === "image" ? "Image" : "Video"} ready`);
            } else {
              toast.error(
                gen.error
                  ? `Couldn't generate the ${noun}. ${gen.error}`
                  : `Couldn't generate the ${noun}. Try again.`,
              );
            }
            onSettledRef.current?.(id);
          }
        } catch {
          // Network blip: keep polling.
        }
      }, POLL_INTERVAL_MS);

      pollTimers.current.set(id, timer);
    },
    [authFetch, category, noun, patch, stopPolling],
  );

  /** Start one generation. Resolves to its id, or null if it didn't start. */
  const submit = useCallback(
    async (request: CatalogSubmit): Promise<string | null> => {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const prompt =
        typeof request.inputs.prompt === "string" ? request.inputs.prompt : "";
      setActiveGenerations((prev) => [
        {
          id: tempId,
          status: "submitting",
          prompt,
          model: request.model,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);

      const fail = (error: string) => {
        patch(tempId, { status: "FAILED", error });
        toast.error(error);
        return null;
      };

      try {
        const res = await authFetch("/api/catalog/generate", {
          method: "POST",
          body: JSON.stringify(request),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.success) {
          if (data.code === "PRICE_CHANGED") {
            // Drop the stale price so the button shows the new one.
            void queryClient.invalidateQueries({
              queryKey: [...catalogQueryKeys.all, "quote"],
            });
            setActiveGenerations((prev) => prev.filter((g) => g.id !== tempId));
            toast.info(data.error);
            return null;
          }
          return fail(data.error || `Couldn't start the ${noun}. Try again.`);
        }

        const realId: string = data.generation.id;
        patch(tempId, { id: realId, status: data.generation.status });
        pollStatus(realId);
        return realId;
      } catch {
        return fail("Couldn't reach the server. Check your connection and try again.");
      }
    },
    [authFetch, noun, patch, pollStatus, queryClient],
  );

  const dismiss = useCallback(
    (id: string) => {
      stopPolling(id);
      setActiveGenerations((prev) => prev.filter((g) => g.id !== id));
    },
    [stopPolling],
  );

  useEffect(() => {
    const timers = pollTimers.current;
    return () => {
      timers.forEach((timer) => clearInterval(timer));
      timers.clear();
    };
  }, []);

  return { activeGenerations, submit, dismiss };
}
