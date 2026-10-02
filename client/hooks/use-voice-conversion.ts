"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuthFetch } from "./use-auth-fetch";
import { toast } from "sonner";

export type VoiceConversionStatus =
  | "idle"
  | "submitting"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface ActiveVoiceConversion {
  id: string;
  status: VoiceConversionStatus;
  error?: string;
  outputAsset?: { id: string; url: string } | null;
  voiceId: string;
  createdAt: string;
}

const POLL_INTERVAL_MS = 3_000;
const AUTO_DISMISS_DELAY_MS = 2_000;

export const voiceConversionQueryKeys = {
  all: ["voice-conversions"] as const,
  list: () => [...voiceConversionQueryKeys.all, "list"] as const,
};

export function useVoiceConversion(options?: {
  onComplete?: (id: string) => void;
}) {
  const { authFetch } = useAuthFetch();
  const [activeConversions, setActiveConversions] = useState<
    ActiveVoiceConversion[]
  >([]);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );
  const onCompleteRef = useRef(options?.onComplete);
  useEffect(() => {
    onCompleteRef.current = options?.onComplete;
  });
  const tempIdCounter = useRef(0);

  const stopPolling = useCallback((conversionId: string) => {
    const timer = pollTimers.current.get(conversionId);
    if (timer) {
      clearInterval(timer);
      pollTimers.current.delete(conversionId);
    }
  }, []);

  const pollStatus = useCallback(
    (conversionId: string) => {
      if (pollTimers.current.has(conversionId)) return;
      const timer = setInterval(async () => {
        try {
          const res = await authFetch(
            `/api/voice-conversions/refresh/${conversionId}`,
          );
          if (!res.ok) return;

          const data = await res.json();
          const conv = data.conversion;
          if (!conv) return;

          setActiveConversions((prev) =>
            prev.map((c) =>
              c.id === conversionId
                ? {
                    ...c,
                    status: conv.status as VoiceConversionStatus,
                    error: conv.error || undefined,
                    outputAsset: conv.outputAsset || undefined,
                  }
                : c,
            ),
          );

          if (conv.status === "COMPLETED" || conv.status === "FAILED") {
            stopPolling(conversionId);
            if (conv.status === "COMPLETED") {
              toast.success("Voice changed");
              onCompleteRef.current?.(conversionId);
              setTimeout(() => {
                setActiveConversions((prev) =>
                  prev.filter((c) => c.id !== conversionId),
                );
              }, AUTO_DISMISS_DELAY_MS);
            } else {
              toast.error(
                conv.error
                  ? `Couldn't change the voice. ${conv.error}`
                  : "Couldn't change the voice. Try again.",
              );
            }
          }
        } catch {
          // A dropped poll is retried on the next tick.
        }
      }, POLL_INTERVAL_MS);

      pollTimers.current.set(conversionId, timer);
    },
    [authFetch, stopPolling],
  );

  const submitConversion = useCallback(
    async (params: { voice_id: string; source_url: string }) => {
      const tempId = `temp-${Date.now()}-${tempIdCounter.current++}`;
      const newConv: ActiveVoiceConversion = {
        id: tempId,
        status: "submitting",
        voiceId: params.voice_id,
        createdAt: new Date().toISOString(),
      };

      setActiveConversions((prev) => [newConv, ...prev]);

      try {
        const res = await authFetch("/api/voice-conversions/create", {
          method: "POST",
          body: JSON.stringify(params),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Couldn't start the conversion. Try again.");
        }

        const conversionId = data.conversion.id as string;

        setActiveConversions((prev) =>
          prev.map((c) =>
            c.id === tempId
              ? { ...c, id: conversionId, status: "QUEUED" }
              : c,
          ),
        );

        pollStatus(conversionId);
        return conversionId;
      } catch (err) {
        setActiveConversions((prev) =>
          prev.map((c) =>
            c.id === tempId
              ? {
                  ...c,
                  status: "FAILED",
                  error:
                    err instanceof Error
                      ? err.message
                      : "Couldn't start the conversion.",
                }
              : c,
          ),
        );
        toast.error(
          err instanceof Error
            ? err.message
            : "Couldn't start the conversion. Try again.",
        );
        return null;
      }
    },
    [authFetch, pollStatus],
  );

  const dismissConversion = useCallback(
    (conversionId: string) => {
      stopPolling(conversionId);
      setActiveConversions((prev) =>
        prev.filter((c) => c.id !== conversionId),
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
    activeConversions,
    submitConversion,
    dismissConversion,
  };
}
