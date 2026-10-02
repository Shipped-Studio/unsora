"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuthFetch } from "./use-auth-fetch";
import { toast } from "sonner";

export type GenerationStatus =
  | "idle"
  | "submitting"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface ActiveGeneration {
  id: string;
  status: GenerationStatus;
  error?: string;
  outputAsset?: { id: string; url: string } | null;
  thumbnailAsset?: { id: string; url: string } | null;
  inputAssets?: { id: string; role: string; order: number; asset: { id: string; url: string } }[];
  prompt: string;
  duration: number;
  ratio: string;
  createdAt: string;
  model?: string;
  functionMode?: string;
}

const POLL_INTERVAL_MS = 4_000;

export function useGeneration() {
  const { authFetch } = useAuthFetch();
  const [activeGenerations, setActiveGenerations] = useState<ActiveGeneration[]>([]);
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
          const res = await authFetch(`/api/generations/refresh/${generationId}`);
          if (!res.ok) return;

          const data = await res.json();
          const gen = data.generation;
          if (!gen) return;

          setActiveGenerations((prev) =>
            prev.map((g) =>
              g.id === generationId
                ? {
                    ...g,
                    status: gen.status as GenerationStatus,
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
              toast.success("Video generation complete!");
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
      model: string;
      functionMode: string;
      ratio: string;
      duration: number;
      image_files?: string[];
      video_files?: string[];
      audio_files?: string[];
      filePaths?: string[];
      inputAssetIds?: string[];
    }) => {
      const tempId = `temp-${Date.now()}`;
      const newGen: ActiveGeneration = {
        id: tempId,
        status: "submitting",
        prompt: params.prompt,
        duration: params.duration,
        ratio: params.ratio,
        createdAt: new Date().toISOString(),
        model: params.model,
        functionMode: params.functionMode,
      };

      setActiveGenerations((prev) => [newGen, ...prev]);

      try {
        const res = await authFetch("/api/generations/create-video", {
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
              ? { ...g, id: realId, status: data.generation.status as GenerationStatus }
              : g,
          ),
        );

        pollStatus(realId);
        return realId;
      } catch (err) {
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
