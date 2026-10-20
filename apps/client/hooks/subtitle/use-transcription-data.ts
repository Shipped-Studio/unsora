"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useSubtitleApi } from "@/hooks/subtitle/use-subtitle-api";
import { isExportRunning } from "@/hooks/subtitle/use-subtitle-queries";
import { failureMessage } from "@/components/subtitle-editor/format";
import type { SubtitleChunk, TranscriptionData } from "@/remotion/types";
import type { CaptionLayout } from "@/components/subtitle-editor/caption-style";

export type TranscriptionStatus =
  | "draft"
  | "pending"
  | "processing"
  | "completed"
  | "failed";

type Project = TranscriptionData & { error?: string | null };

type LoadState =
  | { phase: "loading" }
  | { phase: "ready" }
  | { phase: "not-found" }
  | { phase: "error"; message: string };

const DEFAULT_MAX_WORDS = 5;
const TRANSCRIPTION_POLL_MS = 3000;
const EXPORT_POLL_MS = 5000;

/** Some columns come back as JSON strings. */
function parseJsonField<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value as T | null) ?? fallback;
  try {
    return (JSON.parse(value) as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

function normalize(raw: Project): Project {
  return {
    ...raw,
    subtitleChunks: parseJsonField<SubtitleChunk[]>(raw.subtitleChunks, []),
    segments: parseJsonField<Project["segments"]>(raw.segments, []),
    editorSettings: parseJsonField<Record<string, unknown> | undefined>(
      raw.editorSettings,
      undefined,
    ),
    metadata: parseJsonField<Project["metadata"]>(raw.metadata, null),
    maxWordsPerChunk: raw.maxWordsPerChunk || DEFAULT_MAX_WORDS,
    videoExports: raw.videoExports ?? [],
  };
}

function toStatus(status: string | undefined): TranscriptionStatus {
  switch (status) {
    case undefined:
    case "draft":
      return "draft";
    case "completed":
    case "failed":
    case "pending":
      return status;
    default:
      return "processing";
  }
}

/**
 * Loads one subtitle project and keeps it current: polls while it is being
 * transcribed and while any of its exports are rendering. Subtitle edits live
 * here until the editor saves them.
 */
export function useTranscriptionData(transcriptionId: string) {
  const api = useSubtitleApi();
  const [project, setProject] = useState<Project | null>(null);
  const [load, setLoad] = useState<LoadState>({ phase: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api.getTranscription(transcriptionId).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setProject(normalize(result.data));
        setLoad({ phase: "ready" });
      } else if (result.status === 404) {
        setLoad({ phase: "not-found" });
      } else {
        setLoad({ phase: "error", message: result.error ?? "" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api, transcriptionId, attempt]);

  const retry = useCallback(() => {
    setLoad({ phase: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const status = toStatus(project?.status);
  const isTranscribing = status === "pending" || status === "processing";

  useEffect(() => {
    if (!isTranscribing) return;
    let settled = false;
    const timer = setInterval(async () => {
      const result = await api.getTranscription(transcriptionId);
      // A failed poll is retried on the next tick.
      if (settled || !result.success || !result.data) return;
      const next = normalize(result.data);
      const nextStatus = toStatus(next.status);
      if (nextStatus === "pending" || nextStatus === "processing") return;

      settled = true;
      clearInterval(timer);
      setProject(next);
      if (nextStatus === "completed") {
        toast.success("Transcription finished");
      } else if (nextStatus === "failed") {
        toast.error(failureMessage("transcribe this video", next.error));
      }
    }, TRANSCRIPTION_POLL_MS);

    return () => {
      settled = true;
      clearInterval(timer);
    };
  }, [api, transcriptionId, isTranscribing]);

  const aiTools = project?.metadata?.aiTools ?? {};
  const toolRunning = Object.values(aiTools).some((t) => t.status === "running");

  // A video pass replaces the video and retimes the captions when it's done.
  useEffect(() => {
    if (!toolRunning) return;
    let settled = false;
    const timer = setInterval(async () => {
      const result = await api.getTranscription(transcriptionId);
      if (settled || !result.success || !result.data) return;
      const next = normalize(result.data);
      const tools = next.metadata?.aiTools ?? {};
      if (Object.values(tools).some((t) => t.status === "running")) return;
      settled = true;
      clearInterval(timer);
      setProject(next);
      for (const state of Object.values(tools)) {
        if (state.status === "failed") {
          toast.error(failureMessage("finish the AI tool", state.error));
        }
      }
    }, TRANSCRIPTION_POLL_MS);
    return () => {
      settled = true;
      clearInterval(timer);
    };
  }, [api, transcriptionId, toolRunning]);

  const reload = useCallback(async () => {
    const result = await api.getTranscription(transcriptionId);
    if (result.success && result.data) setProject(normalize(result.data));
  }, [api, transcriptionId]);

  /** Starts an AI Tools pass; returns the scenes for Auto Zooms. */
  const runAiTool = useCallback(
    async (tool: string) => {
      const result = await api.runAiTool(transcriptionId, tool);
      if (!result.success || !result.data) {
        toast.error(failureMessage("run the tool", result.error));
        return null;
      }
      if (result.data.status === "running") {
        setProject(
          (prev) =>
            prev && {
              ...prev,
              metadata: {
                ...prev.metadata,
                aiTools: {
                  ...prev.metadata?.aiTools,
                  [tool]: { status: "running", updatedAt: new Date().toISOString() },
                },
              },
            },
        );
      } else {
        await reload();
      }
      return result.data;
    },
    [api, transcriptionId, reload],
  );

  const removeAiTool = useCallback(
    async (tool: string) => {
      const result = await api.removeAiTool(transcriptionId, tool);
      if (!result.success) {
        toast.error(failureMessage("remove the tool", result.error));
        return false;
      }
      await reload();
      return true;
    },
    [api, transcriptionId, reload],
  );

  /** Reloads only the export list, so unsaved subtitle edits survive. */
  const refreshExports = useCallback(async () => {
    const result = await api.getTranscription(transcriptionId);
    if (!result.success || !result.data) return;
    const videoExports = result.data.videoExports ?? [];
    setProject((prev) => prev && { ...prev, videoExports });
  }, [api, transcriptionId]);

  const videoExports = project?.videoExports;
  useEffect(() => {
    if (!videoExports?.some(isExportRunning)) return;
    const timer = setInterval(() => void refreshExports(), EXPORT_POLL_MS);
    return () => clearInterval(timer);
  }, [videoExports, refreshExports]);

  const startTranscription = useCallback(
    async (options: { language?: string; layout?: CaptionLayout }) => {
      setIsStarting(true);
      const result = await api.startTranscription(transcriptionId, options);
      setIsStarting(false);
      if (!result.success) {
        toast.error(failureMessage("start transcription", result.error));
        return;
      }
      setProject((prev) => prev && { ...prev, status: "pending", error: null });
    },
    [api, transcriptionId],
  );

  const setChunks = useCallback((subtitleChunks: SubtitleChunk[]) => {
    setProject((prev) => prev && { ...prev, subtitleChunks });
  }, []);

  return {
    project,
    phase: load.phase,
    loadError: load.phase === "error" && load.message ? load.message : null,
    retry,
    status,
    transcriptionError: project?.error ?? null,
    isStarting,
    startTranscription,
    setChunks,
    refreshExports,
    aiTools,
    runAiTool,
    removeAiTool,
  };
}
