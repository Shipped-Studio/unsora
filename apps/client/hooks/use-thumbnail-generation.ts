"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuthFetch } from "./use-auth-fetch";
import { toast } from "sonner";

export type ThumbnailGenerationStatus =
  | "submitting"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface ActiveThumbnailGeneration {
  id: string;
  status: ThumbnailGenerationStatus;
  error?: string;
  outputAsset?: { id: string; url: string } | null;
  thumbnailAsset?: { id: string; url: string } | null;
  prompt: string;
  createdAt: string;
}

const POLL_INTERVAL_MS = 4_000;
const AUTO_DISMISS_DELAY_MS = 2_000;

export function useThumbnailGeneration(options?: {
  onComplete?: (id: string) => void;
}) {
  const { authFetch } = useAuthFetch();
  const [activeGenerations, setActiveGenerations] = useState<
    ActiveThumbnailGeneration[]
  >([]);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );
  const onCompleteRef = useRef(options?.onComplete);
  useEffect(() => {
    onCompleteRef.current = options?.onComplete;
  });

  const stopPolling = useCallback((generationId: string) => {
    const timer = pollTimers.current.get(generationId);
    if (timer) {
      clearInterval(timer);
      pollTimers.current.delete(generationId);
    }
  }, []);

  const pollStatus = useCallback(
    (generationId: string) => {
      if (pollTimers.current.has(generationId)) return;

      const timer = setInterval(async () => {
        try {
          const res = await authFetch(
            `/api/thumbnails/refresh/${generationId}`,
          );
          if (!res.ok) return;

          const data = await res.json();
          const gen = data.generation;
          if (!gen) return;

          setActiveGenerations((prev) =>
            prev.map((g) =>
              g.id === generationId
                ? {
                    ...g,
                    status: gen.status as ThumbnailGenerationStatus,
                    error: gen.error || undefined,
                    outputAsset: gen.outputAsset || undefined,
                    thumbnailAsset: gen.thumbnailAsset || undefined,
                  }
                : g,
            ),
          );

          if (gen.status === "COMPLETED" || gen.status === "FAILED") {
            stopPolling(generationId);
            if (gen.status === "COMPLETED") {
              toast.success("Thumbnail ready");
              onCompleteRef.current?.(generationId);
              setTimeout(() => {
                setActiveGenerations((prev) =>
                  prev.filter((g) => g.id !== generationId),
                );
              }, AUTO_DISMISS_DELAY_MS);
            } else {
              toast.error(
                gen.error
                  ? `Couldn't generate the thumbnail. ${gen.error}`
                  : "Couldn't generate the thumbnail. Try again.",
              );
            }
          }
        } catch {
          // Network blip: keep polling.
        }
      }, POLL_INTERVAL_MS);

      pollTimers.current.set(generationId, timer);
    },
    [authFetch, stopPolling],
  );

  const trackGenerations = useCallback(
    (
      generations: { id: string; status: string }[],
      prompt: string,
    ) => {
      if (generations.length === 0) return;

      const now = new Date().toISOString();
      const entries: ActiveThumbnailGeneration[] = generations.map((g) => ({
        id: g.id,
        status: g.status as ThumbnailGenerationStatus,
        prompt,
        createdAt: now,
      }));

      setActiveGenerations((prev) => [...entries, ...prev]);

      for (const g of generations) {
        if (g.status !== "COMPLETED" && g.status !== "FAILED") {
          pollStatus(g.id);
        }
      }
    },
    [pollStatus],
  );

  const dismissGeneration = useCallback(
    (generationId: string) => {
      stopPolling(generationId);
      setActiveGenerations((prev) =>
        prev.filter((g) => g.id !== generationId),
      );
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

  return {
    activeGenerations,
    trackGenerations,
    dismissGeneration,
  };
}
