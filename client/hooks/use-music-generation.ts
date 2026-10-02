"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuthFetch } from "./use-auth-fetch";
import { toast } from "sonner";
import { formatTrackLabel, deriveSongTitleFromLyrics } from "@/lib/music-track";

export type MusicGenerationStatus =
  | "idle"
  | "submitting"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface ActiveMusicGeneration {
  id: string;
  status: MusicGenerationStatus;
  error?: string;
  outputAsset?: { id: string; url: string } | null;
  lyrics: string;
  prompt: string;
  model: string;
  trackNumber?: number;
  songTitle?: string;
  createdAt: string;
}

const POLL_INTERVAL_MS = 4_000;
const AUTO_DISMISS_DELAY_MS = 2_000;

export function useMusicGeneration(options?: {
  onComplete?: (id: string) => void;
}) {
  const { authFetch } = useAuthFetch();
  const [activeGenerations, setActiveGenerations] = useState<
    ActiveMusicGeneration[]
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
            `/api/music-generations/refresh/${generationId}`,
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
                    status: gen.status as MusicGenerationStatus,
                    error: gen.error || undefined,
                    outputAsset: gen.outputAsset || undefined,
                    trackNumber: gen.trackNumber ?? g.trackNumber,
                    songTitle: gen.songTitle ?? g.songTitle,
                  }
                : g,
            ),
          );

          if (gen.status === "COMPLETED" || gen.status === "FAILED") {
            stopPolling(generationId);
            if (gen.status === "COMPLETED") {
              const label =
                gen.trackNumber != null && gen.trackNumber > 0
                  ? formatTrackLabel(gen.trackNumber)
                  : "Track";
              const name = gen.songTitle ? `${label} — ${gen.songTitle}` : label;
              toast.success(`${name} is ready!`);
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
      lyrics: string;
      prompt: string;
      model: string;
      output_format?: string;
      voice_id?: string;
    }) => {
      const tempId = `temp-${Date.now()}-${tempIdCounter.current++}`;
      const songTitle = deriveSongTitleFromLyrics(
        params.lyrics,
        params.prompt,
      );
      const newGen: ActiveMusicGeneration = {
        id: tempId,
        status: "submitting",
        lyrics: params.lyrics,
        prompt: params.prompt,
        model: params.model,
        songTitle,
        createdAt: new Date().toISOString(),
      };

      setActiveGenerations((prev) => [newGen, ...prev]);

      try {
        const res = await authFetch("/api/music-generations/create", {
          method: "POST",
          body: JSON.stringify(params),
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
                  status: data.generation.status as MusicGenerationStatus,
                  trackNumber: data.generation.trackNumber,
                  songTitle: data.generation.songTitle,
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
