"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useSubtitleApi } from "@/hooks/subtitle/use-subtitle-api";
import {
  useSetCreditBalance,
  userUsageQueryKeys,
} from "@/hooks/use-user-usage";
import type { EditorSettings } from "@/remotion/types";

type ExportStatus = "idle" | "queued" | "processing" | "completed" | "failed";

export const useExportJob = () => {
  const { createExport, getExportJobStatus } = useSubtitleApi();
  const setCreditBalance = useSetCreditBalance();
  const queryClient = useQueryClient();
  const refreshCreditBalance = () => {
    queryClient.invalidateQueries({ queryKey: userUsageQueryKeys.usage() });
  };

  const [isExporting, setIsExporting] = useState(false);
  const [exportTaskId, setExportTaskId] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);

  const exportStatusRef = useRef<ExportStatus>("idle");
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateExportStatus = (status: ExportStatus) => {
    exportStatusRef.current = status;
    setExportStatus(status);
  };

  const clearExportTimers = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const pollForExportUpdates = async (
    taskId: string,
    onComplete?: () => void
  ) => {
    clearExportTimers();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const result = await getExportJobStatus(taskId);

        if (result.success && result.data) {
          const { progress, status, result: jobResult } = result.data;

          setExportProgress(progress || 0);
          updateExportStatus(status);

          if (
            status === "completed" &&
            jobResult?.success &&
            jobResult.videoUrl
          ) {
            setExportedVideoUrl(jobResult.videoUrl);
            setIsExporting(false);
            toast.success("Video exported successfully!");

            if (onComplete) {
              await onComplete();
            }

            clearExportTimers();
          } else if (status === "failed") {
            setIsExporting(false);
            toast.error(jobResult?.error || "Export job failed");
            // The worker refunds credits on permanent failure — refresh the
            // sidebar so the user sees the credits returned.
            refreshCreditBalance();
            clearExportTimers();
          }
        }
      } catch (error) {
        console.error("Export polling error:", error);
        clearExportTimers();
        setIsExporting(false);
        updateExportStatus("failed");
        toast.error("Failed to check export status");
      }
    }, 2000);

    timeoutRef.current = setTimeout(() => {
      clearExportTimers();
      if (exportStatusRef.current === "processing") {
        setIsExporting(false);
        updateExportStatus("failed");
        toast.error("Export timed out. Please try again.");
      }
    }, 1800000);
  };

  const startExport = async (
    transcriptionId: string,
    videoUrl: string,
    subtitleChunks: any[],
    settings: EditorSettings,
    duration: number,
    width: number,
    height: number,
    onComplete?: () => void
  ) => {
    setIsExporting(true);
    updateExportStatus("queued");
    setExportProgress(0);
    setExportedVideoUrl(null);

    try {
      toast.info("Queueing video export job...");

      const result = await createExport({
        transcriptionId,
        videoUrl,
        subtitleChunks,
        style: settings,
        duration,
        fps: 30,
        width,
        height,
      });

      if (!result.success || !result.data?.taskId) {
        // 402 (insufficient credits) and other validation errors land here.
        // The server already echoes a friendly message in `result.error`.
        if (typeof result.data?.creditsAvailable === "number") {
          setCreditBalance(result.data.creditsAvailable);
        }
        throw new Error(result.error || "Failed to queue export job");
      }

      // Reflect the deduction in the sidebar immediately — no need to wait for
      // the next /api/user/usage refresh.
      if (typeof result.data.creditsRemaining === "number") {
        setCreditBalance(result.data.creditsRemaining);
      }

      const taskId = result.data.taskId;
      setExportTaskId(taskId);
      updateExportStatus("processing");

      const usedSuffix =
        typeof result.data.creditsUsed === "number"
          ? ` (${result.data.creditsUsed} credits charged)`
          : "";
      toast.success(
        `Export job queued! Processing will begin shortly...${usedSuffix}`
      );

      pollForExportUpdates(taskId, onComplete);
    } catch (error) {
      console.error("Export error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to queue export job"
      );
      setIsExporting(false);
      updateExportStatus("failed");
    }
  };

  const resetExportState = () => {
    clearExportTimers();
    setIsExporting(false);
    setExportTaskId(null);
    setExportProgress(0);
    updateExportStatus("idle");
    setExportedVideoUrl(null);
  };

  return {
    isExporting,
    exportTaskId,
    exportProgress,
    exportStatus,
    exportedVideoUrl,
    startExport,
    resetExportState,
  };
};
