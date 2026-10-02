"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuthFetch } from "./use-auth-fetch";
import { toast } from "sonner";

export type ImageGenerationStatus =
  | "idle"
  | "submitting"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface ActiveImageGeneration {
  id: string;
  status: ImageGenerationStatus;
  error?: string;
  outputAsset?: { id: string; url: string } | null;
  thumbnailAsset?: { id: string; url: string } | null;
  prompt: string;
  model: string;
  ratio: string;
  createdAt: string;
}

const POLL_INTERVAL_MS = 4_000;
const AUTO_DISMISS_DELAY_MS = 2_000;

export function useImageGeneration(options?: {
  onComplete?: (id: string) => void;
}) {
  const { authFetch } = useAuthFetch();
  const [activeGenerations, setActiveGenerations] = useState<
    ActiveImageGeneration[]
  >([]);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );
  const onCompleteRef = useRef(options?.onComplete);
  onCompleteRef.current = options?.onComplete;
  const tempIdCounter = useRef(0);

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
            `/api/image-generations/refresh/${generationId}`,
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
                    status: gen.status as ImageGenerationStatus,
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
              toast.success("Image generation complete!");
              onCompleteRef.current?.(generationId);
              setTimeout(() => {
                setActiveGenerations((prev) =>
                  prev.filter((g) => g.id !== generationId),
                );
              }, AUTO_DISMISS_DELAY_MS);
            } else {
              toast.error(
                `Generation failed: ${gen.error || "Unknown error"}`,
              );
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
      ratio: string;
      resolution?: string;
      quality?: string;
      nsfwChecker?: boolean;
      images?: string[];
    }) => {
      const tempId = `temp-${Date.now()}-${tempIdCounter.current++}`;
      const newGen: ActiveImageGeneration = {
        id: tempId,
        status: "submitting",
        prompt: params.prompt,
        model: params.model,
        ratio: params.ratio,
        createdAt: new Date().toISOString(),
      };

      setActiveGenerations((prev) => [newGen, ...prev]);

      try {
        const { images, quality, ratio, model, ...rest } = params;
        const body: Record<string, unknown> = { ...rest, model, ratio };

        if (model === "gpt-image-1.5") {
          const sizeByRatio: Record<string, string> = {
            "1:1": "1024x1024",
            "2:3": "1024x1536",
            "3:2": "1536x1024",
          };
          body.resolution = sizeByRatio[ratio] ?? "1024x1024";
          if (quality) body.quality = quality;
        } else if (rest.resolution) {
          body.resolution = rest.resolution;
        }

        if (images?.length) {
          body.referenceImageUrls = images;
        }

        const res = await authFetch("/api/image-generations/create", {
          method: "POST",
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          const errorMsg = data.error || "Failed to start generation";
          setActiveGenerations((prev) =>
            prev.map((g) =>
              g.id === tempId
                ? { ...g, status: "FAILED" as const, error: errorMsg }
                : g,
            ),
          );
          toast.error(errorMsg);
          return null;
        }

        const realId = data.generation.id;
        setActiveGenerations((prev) =>
          prev.map((g) =>
            g.id === tempId
              ? {
                  ...g,
                  id: realId,
                  status: data.generation.status as ImageGenerationStatus,
                }
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
    submitGeneration,
    dismissGeneration,
  };
}
