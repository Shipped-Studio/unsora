"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useSubtitleApi } from "@/hooks/subtitle/use-subtitle-api";
import { isExportRunning } from "@/hooks/subtitle/use-subtitle-queries";
import { failureMessage } from "@/components/subtitle-editor/format";
import type {
  SubtitleChunk,
  TranscriptionData,
  WordTimestamp,
} from "@/remotion/types";

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
/** Break a line on pauses this long, so subtitles don't linger. */
const CHUNK_GAP_SECONDS = 1.5;
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
 * Group word timestamps into lines of at most `maxWords`, also breaking on
 * silences. Mirrors groupWordsIntoChunks in server/src/lib/transcription.ts.
 */
function rechunk(
  segments: Project["segments"],
  maxWords: number,
): SubtitleChunk[] {
  const chunks: SubtitleChunk[] = [];
  let current: WordTimestamp[] = [];

  const flush = () => {
    if (!current.length) return;
    chunks.push({
      text: current.map((w) => w.word).join(" "),
      start: current[0].start,
      end: current[current.length - 1].end,
      words: current,
    });
    current = [];
  };

  for (const word of segments.flatMap((s) => s.words ?? [])) {
    const prev = current[current.length - 1];
    if (
      current.length >= maxWords ||
      (prev && word.start - prev.end >= CHUNK_GAP_SECONDS)
    ) {
      flush();
    }
    current.push(word);
  }
  flush();

  return chunks;
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
    async (options: { language?: string; maxWordsPerChunk?: number }) => {
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

  const setMaxWords = useCallback(
    (maxWordsPerChunk: number) => {
      if (!project) return;
      const hasWordTimings = project.segments.some((s) => s.words?.length);
      // Old transcriptions have no word timings to regroup.
      if (!hasWordTimings && project.subtitleChunks.length > 0) {
        toast.error(
          "Couldn't regroup these subtitles. Transcribe the video again to change words per line.",
        );
        return;
      }
      setProject(
        (prev) =>
          prev && {
            ...prev,
            maxWordsPerChunk,
            subtitleChunks: hasWordTimings
              ? rechunk(prev.segments, maxWordsPerChunk)
              : prev.subtitleChunks,
          },
      );
    },
    [project],
  );

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
    setMaxWords,
    refreshExports,
  };
}
