"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuthFetch } from "./use-auth-fetch";
import { toast } from "sonner";

export type VoiceGenerationStatus =
  | "idle"
  | "submitting"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface ActiveVoiceGeneration {
  id: string;
  status: VoiceGenerationStatus;
  error?: string;
  outputAsset?: { id: string; url: string } | null;
  text: string;
  voiceId: string;
  emotion: string;
  model: string;
  createdAt: string;
}

const POLL_INTERVAL_MS = 3_000;
const AUTO_DISMISS_DELAY_MS = 2_000;

export const voiceGenerationQueryKeys = {
  all: ["voice-generations"] as const,
  list: () => [...voiceGenerationQueryKeys.all, "list"] as const,
};

export function useVoiceGeneration(options?: {
  onComplete?: (id: string) => void;
}) {
  const { authFetch } = useAuthFetch();
  const [activeGenerations, setActiveGenerations] = useState<
    ActiveVoiceGeneration[]
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
            `/api/voice-generations/refresh/${generationId}`,
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
                    status: gen.status as VoiceGenerationStatus,
                    error: gen.error || undefined,
                    outputAsset: gen.outputAsset || undefined,
                  }
                : g,
            ),
          );

          if (gen.status === "COMPLETED" || gen.status === "FAILED") {
            stopPolling(generationId);
            if (gen.status === "COMPLETED") {
              toast.success("Voiceover ready");
              onCompleteRef.current?.(generationId);
              setTimeout(() => {
                setActiveGenerations((prev) =>
                  prev.filter((g) => g.id !== generationId),
                );
              }, AUTO_DISMISS_DELAY_MS);
            } else {
              toast.error(
                gen.error
                  ? `Couldn't generate the voiceover. ${gen.error}`
                  : "Couldn't generate the voiceover. Try again.",
              );
            }
          }
        } catch {
          // A dropped poll is retried on the next tick.
        }
      }, POLL_INTERVAL_MS);

      pollTimers.current.set(generationId, timer);
    },
    [authFetch, stopPolling],
  );

  const submitGeneration = useCallback(
    async (params: {
      text: string;
      voice_id: string;
      emotion: string;
      speed?: number;
      stability?: number;
      similarity?: number;
      model?: string;
      output_format?: string;
    }) => {
      const tempId = `temp-${Date.now()}-${tempIdCounter.current++}`;
      const newGen: ActiveVoiceGeneration = {
        id: tempId,
        status: "submitting",
        text: params.text,
        voiceId: params.voice_id,
        emotion: params.emotion,
        model: params.model ?? "minimax-speech-2.6-hd",
        createdAt: new Date().toISOString(),
      };

      setActiveGenerations((prev) => [newGen, ...prev]);

      try {
        const res = await authFetch("/api/voice-generations/create", {
          method: "POST",
          body: JSON.stringify(params),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          const errorMsg =
            data.error || "Couldn't start the voiceover. Try again.";
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
                  status: data.generation.status as VoiceGenerationStatus,
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
              ? {
                  ...g,
                  status: "FAILED" as const,
                  error: "Couldn't reach the server.",
                }
              : g,
          ),
        );
        toast.error(
          "Couldn't reach the server. Check your connection and try again.",
        );
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
