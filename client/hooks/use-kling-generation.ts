"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuthFetch } from "./use-auth-fetch";
import { toast } from "sonner";

export type KlingGenerationStatus =
  | "idle"
  | "submitting"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface ActiveKlingGeneration {
  id: string;
  status: KlingGenerationStatus;
  error?: string;
  outputAsset?: { id: string; url: string } | null;
  prompt: string;
  duration: number;
  aspectRatio: string;
  createdAt: string;
}

const POLL_INTERVAL_MS = 4_000;

export function useKlingGeneration() {
  const { authFetch } = useAuthFetch();
  const [activeGenerations, setActiveGenerations] = useState<ActiveKlingGeneration[]>([]);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

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
          const res = await authFetch(`/api/kling/refresh/${generationId}`);
          if (!res.ok) return;

          const data = await res.json();
          const gen = data.generation;
          if (!gen) return;

          setActiveGenerations((prev) =>
            prev.map((g) =>
              g.id === generationId
                ? {
                    ...g,
                    status: gen.status as KlingGenerationStatus,
                    error: gen.error || undefined,
                    outputAsset: gen.outputAsset || undefined,
                  }
                : g,
            ),
          );

          if (gen.status === "COMPLETED" || gen.status === "FAILED") {
            stopPolling(generationId);
            if (gen.status === "COMPLETED") {
              toast.success("Kling video generation complete!");
            } else {
              toast.error(`Generation failed: ${gen.error || "Unknown error"}`);
            }
          }
        } catch {
          // network blip — keep polling
        }
      }, POLL_INTERVAL_MS);

      pollTimers.current.set(generationId, timer);
    },
    [authFetch, stopPolling],
  );

  const submitGeneration = useCallback(
    async (params: {
      prompt: string;
      aspect_ratio: string;
      cfg_scale: number;
      duration: number;
      sound?: boolean;
      image?: string;
      end_image?: string;
    }) => {
      const tempId = `temp-${Date.now()}`;
      const newGen: ActiveKlingGeneration = {
        id: tempId,
        status: "submitting",
        prompt: params.prompt,
        duration: params.duration,
        aspectRatio: params.aspect_ratio,
        createdAt: new Date().toISOString(),
      };

      setActiveGenerations((prev) => [newGen, ...prev]);

      try {
        const res = await authFetch("/api/kling/create-video", {
          method: "POST",
          body: JSON.stringify(params),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          const errorMsg = data.error || "Failed to start generation";
          setActiveGenerations((prev) =>
            prev.map((g) =>
              g.id === tempId ? { ...g, status: "FAILED" as const, error: errorMsg } : g,
            ),
          );
          toast.error(errorMsg);
          return null;
        }

        const realId = data.generation.id;
        setActiveGenerations((prev) =>
          prev.map((g) =>
            g.id === tempId
              ? { ...g, id: realId, status: data.generation.status as KlingGenerationStatus }
              : g,
          ),
        );

        pollStatus(realId);
        return realId;
      } catch {
        setActiveGenerations((prev) =>
          prev.map((g) =>
            g.id === tempId
              ? { ...g, status: "FAILED" as const, error: "Network error" }
              : g,
          ),
        );
        toast.error("Network error — please try again");
        return null;
      }
    },
    [authFetch, pollStatus],
  );

  const dismissGeneration = useCallback(
    (generationId: string) => {
      stopPolling(generationId);
      setActiveGenerations((prev) => prev.filter((g) => g.id !== generationId));
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
    submitGeneration,
    dismissGeneration,
  };
}
