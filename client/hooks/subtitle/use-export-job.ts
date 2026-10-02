"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSubtitleApi,
  type ExportRequest,
} from "@/hooks/subtitle/use-subtitle-api";
import { subtitleQueryKeys } from "@/hooks/subtitle/use-subtitle-queries";
import {
  useSetCreditBalance,
  userUsageQueryKeys,
} from "@/hooks/use-user-usage";

export type ExportJobStatus =
  | "idle"
  | "queued"
  | "processing"
  | "completed"
  | "failed";

interface ExportJobState {
  status: ExportJobStatus;
  progress: number;
  videoUrl: string | null;
  error: string | null;
  creditsUsed: number | null;
}

const IDLE: ExportJobState = {
  status: "idle",
  progress: 0,
  videoUrl: null,
  error: null,
  creditsUsed: null,
};

const EXPORT_FPS = 30;
const POLL_MS = 2000;
const TIMEOUT_MS = 30 * 60 * 1000;
/** Consecutive status checks that may fail before we give up. */
const MAX_POLL_FAILURES = 5;

/**
 * Queues one render and follows it until it finishes. Starting a new export
 * or calling `reset` stops following the previous one; the render itself
 * keeps going on the server.
 */
export function useExportJob({
  onSettled,
}: {
  /** Called when the followed render completes or fails. */
  onSettled?: (status: "completed" | "failed") => void;
} = {}) {
  const api = useSubtitleApi();
  const queryClient = useQueryClient();
  const setCreditBalance = useSetCreditBalance();
  const [job, setJob] = useState<ExportJobState>(IDLE);

  // Each export gets a run number; late responses from an older run are ignored.
  const runRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSettledRef = useRef(onSettled);

  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  const stopTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  }, []);

  useEffect(() => {
    const runs = runRef;
    return () => {
      runs.current += 1;
      stopTimers();
    };
  }, [stopTimers]);

  const settle = useCallback(
    (
      run: number,
      next: Partial<ExportJobState> & { status: "completed" | "failed" },
    ) => {
      if (run !== runRef.current) return;
      stopTimers();
      setJob((prev) => ({ ...prev, ...next }));
      void queryClient.invalidateQueries({
        queryKey: subtitleQueryKeys.exports(),
      });
      if (next.status === "failed") {
        // The worker refunds credits when a render fails for good.
        void queryClient.invalidateQueries({
          queryKey: userUsageQueryKeys.usage(),
        });
      }
      onSettledRef.current?.(next.status);
    },
    [queryClient, stopTimers],
  );

  const startExport = useCallback(
    async (request: Omit<ExportRequest, "fps">): Promise<boolean> => {
      stopTimers();
      const run = ++runRef.current;
      setJob({ ...IDLE, status: "queued" });

      const result = await api.createExport({ ...request, fps: EXPORT_FPS });
      if (run !== runRef.current) return false;

      if (!result.success || !result.data?.taskId) {
        if (typeof result.data?.creditsAvailable === "number") {
          setCreditBalance(result.data.creditsAvailable);
        }
        setJob({
          ...IDLE,
          status: "failed",
          error: result.error || "The export couldn't be queued. Try again.",
        });
        return false;
      }

      const { taskId, creditsUsed, creditsRemaining } = result.data;
      if (typeof creditsRemaining === "number") {
        setCreditBalance(creditsRemaining);
      }
      setJob((prev) => ({
        ...prev,
        status: "processing",
        creditsUsed: creditsUsed ?? null,
      }));
      void queryClient.invalidateQueries({
        queryKey: subtitleQueryKeys.exports(),
      });

      let failures = 0;
      intervalRef.current = setInterval(async () => {
        const status = await api.getExportJobStatus(taskId);
        if (run !== runRef.current) return;

        if (!status.success || !status.data) {
          failures += 1;
          if (failures >= MAX_POLL_FAILURES) {
            settle(run, {
              status: "failed",
              error:
                "Couldn't check on the export. Look in Exports in a few minutes.",
            });
          }
          return;
        }
        failures = 0;

        const { progress, result: jobResult, failedReason } = status.data;
        if (status.data.status === "completed") {
          if (jobResult?.success && jobResult.videoUrl) {
            settle(run, {
              status: "completed",
              progress: 100,
              videoUrl: jobResult.videoUrl,
            });
          } else {
            settle(run, {
              status: "failed",
              error: jobResult?.error || "The render finished without a video.",
            });
          }
        } else if (status.data.status === "failed") {
          settle(run, {
            status: "failed",
            error: jobResult?.error || failedReason || "The render failed.",
          });
        } else {
          setJob((prev) => ({ ...prev, progress: progress || 0 }));
        }
      }, POLL_MS);

      timeoutRef.current = setTimeout(() => {
        settle(run, {
          status: "failed",
          error: "The export is taking too long. Look in Exports later.",
        });
      }, TIMEOUT_MS);

      return true;
    },
    [api, queryClient, setCreditBalance, settle, stopTimers],
  );

  const reset = useCallback(() => {
    runRef.current += 1;
    stopTimers();
    setJob(IDLE);
  }, [stopTimers]);

  return {
    ...job,
    isExporting: job.status === "queued" || job.status === "processing",
    startExport,
    reset,
  };
}
