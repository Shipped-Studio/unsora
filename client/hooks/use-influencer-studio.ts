"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuthFetch } from "./use-auth-fetch";
import { toast } from "sonner";

export type InfluencerStatus =
  | "idle"
  | "submitting"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface ActiveInfluencerGeneration {
  id: string;
  status: InfluencerStatus;
  error?: string;
  outputAsset?: { id: string; url: string } | null;
  thumbnailAsset?: { id: string; url: string } | null;
  prompt: string;
  createdAt: string;
}

const POLL_INTERVAL_MS = 4_000;
const AUTO_DISMISS_DELAY_MS = 2_000;

export function useInfluencerStudio(options?: {
  onComplete?: (id: string) => void;
}) {
  const { authFetch } = useAuthFetch();
  const [activeGenerations, setActiveGenerations] = useState<
    ActiveInfluencerGeneration[]
  >([]);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );
  const onCompleteRef = useRef(options?.onComplete);
  useEffect(() => {
    onCompleteRef.current = options?.onComplete;
  });
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
            `/api/influencer-studio/refresh/${generationId}`,
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
                    status: gen.status as InfluencerStatus,
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
              toast.success("Influencer image generated!");
              onCompleteRef.current?.(generationId);
              setTimeout(() => {
                setActiveGenerations((prev) =>
                  prev.filter((g) => g.id !== generationId),
                );
              }, AUTO_DISMISS_DELAY_MS);
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

  const submit = useCallback(
    async (payload: {
      prompt: string;
      aspectRatio: string;
      cameraAngle?: string;
      styleMode?: string;
      age?: number;
      count: number;
    }) => {
      const tempIds: string[] = [];
      const now = new Date().toISOString();

      for (let i = 0; i < payload.count; i++) {
        const tempId = `temp-${Date.now()}-${tempIdCounter.current++}`;
        tempIds.push(tempId);
        setActiveGenerations((prev) => [
          {
            id: tempId,
            status: "submitting",
            prompt: payload.prompt,
            createdAt: now,
          },
          ...prev,
        ]);
      }

      try {
        const res = await authFetch("/api/influencer-studio/create", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          const errorMsg = data.error || "Failed to start generation";
          setActiveGenerations((prev) =>
            prev.map((g) =>
              tempIds.includes(g.id)
                ? { ...g, status: "FAILED" as const, error: errorMsg }
                : g,
            ),
          );
          toast.error(errorMsg);
          return null;
        }

        const realGenerations: { id: string; status: string }[] =
          data.generations;

        setActiveGenerations((prev) => {
          const updated = [...prev];
          for (let i = 0; i < tempIds.length; i++) {
            const real = realGenerations[i];
            if (!real) continue;
            const idx = updated.findIndex((g) => g.id === tempIds[i]);
            if (idx !== -1) {
              updated[idx] = {
                ...updated[idx],
                id: real.id,
                status: real.status as InfluencerStatus,
              };
            }
          }
          return updated;
        });

        for (const real of realGenerations) {
          pollStatus(real.id);
        }

        return realGenerations.map((g) => g.id);
      } catch {
        setActiveGenerations((prev) =>
          prev.map((g) =>
            tempIds.includes(g.id)
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

  const dismiss = useCallback(
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
    submit,
    dismiss,
  };
}
