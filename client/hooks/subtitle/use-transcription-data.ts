"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useSubtitleApi } from "@/hooks/subtitle/use-subtitle-api";
import {
  TranscriptionData,
  SubtitleChunk,
  WordTimestamp,
} from "@/remotion/types";

export type TranscriptionStatus =
  | "draft"
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export const useTranscriptionData = (transcriptionId: string) => {
  const { getTranscriptionById, startTranscription: startTranscriptionApi } =
    useSubtitleApi();

  const [transcriptionData, setTranscriptionData] =
    useState<TranscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] =
    useState<TranscriptionStatus>("draft");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Function to process transcription data (parse JSON strings if needed)
  const processTranscriptionData = (data: any): TranscriptionData => {
    let processedData = data;

    if (typeof data.subtitleChunks === "string") {
      try {
        processedData = {
          ...data,
          subtitleChunks: JSON.parse(data.subtitleChunks),
        };
      } catch (e) {
        console.error("Failed to parse subtitleChunks:", e);
      }
    }

    if (typeof processedData.segments === "string") {
      try {
        processedData = {
          ...processedData,
          segments: JSON.parse(processedData.segments),
        };
      } catch (e) {
        console.error("Failed to parse segments:", e);
      }
    }

    return processedData;
  };

  // Re-chunk word timestamps by maxWords, also breaking on silence gaps so
  // subtitles don't linger through pauses. Mirrors groupWordsIntoChunks on
  // the server (server/src/lib/transcription.ts).
  const CHUNK_GAP_SECONDS = 1.5;
  const rechunkSegments = (
    segments: TranscriptionData["segments"],
    maxWords: number,
  ): SubtitleChunk[] => {
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

    for (const word of segments.flatMap((s) => s.words)) {
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
  };

  const fetchAndProcess = useCallback(async () => {
    const result = await getTranscriptionById(transcriptionId);
    if (!result.success) {
      throw new Error(result.error || "Failed to load transcription");
    }

    const processedData = processTranscriptionData(result.data);
    if (!processedData.maxWordsPerChunk) {
      processedData.maxWordsPerChunk = 5;
    }
    setTranscriptionData(processedData);

    const serverStatus = processedData.status as string;
    if (serverStatus === "completed") {
      setTranscriptionStatus("completed");
    } else if (serverStatus === "failed") {
      setTranscriptionStatus("failed");
    } else if (serverStatus === "draft") {
      setTranscriptionStatus("draft");
    } else {
      setTranscriptionStatus(
        serverStatus === "pending" ? "pending" : "processing",
      );
    }

    return serverStatus;
  }, [transcriptionId]);

  // Load transcription data; only auto-poll if already processing/pending
  useEffect(() => {
    if (!transcriptionId) return;

    let cancelled = false;

    const loadTranscription = async () => {
      try {
        setIsLoading(true);
        const status = await fetchAndProcess();

        if (!cancelled && (status === "pending" || status === "processing")) {
          startPolling();
        }
      } catch (error) {
        console.error("Error loading transcription:", error);
        const msg =
          error instanceof Error ? error.message : "Failed to load transcription";
        if (
          msg.includes("not found") ||
          msg.includes("Not found") ||
          msg.includes("404")
        ) {
          setNotFound(true);
        } else {
          toast.error(msg);
          setTranscriptionStatus("failed");
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadTranscription();

    return () => {
      cancelled = true;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [transcriptionId, fetchAndProcess]);

  // Refresh transcription data
  const refreshTranscriptionData = async () => {
    const refreshedData = await getTranscriptionById(transcriptionId);
    if (refreshedData.success && refreshedData.data) {
      const processedData = processTranscriptionData(refreshedData.data);
      // Ensure maxWordsPerChunk has a default value
      if (!processedData.maxWordsPerChunk) {
        processedData.maxWordsPerChunk = 5;
      }
      setTranscriptionData(processedData);
    }
  };

  // Handle words per chunk change
  const handleMaxWordsChange = (value: number) => {
    if (transcriptionData && transcriptionData.segments) {
      const newChunks = rechunkSegments(transcriptionData.segments, value);
      // Old transcriptions may have segments without word timestamps —
      // keep the existing chunks rather than wiping the subtitles.
      if (!newChunks.length) {
        toast.error(
          "This transcription has no word timestamps — re-transcribe to change words per line",
        );
        return;
      }
      setTranscriptionData({
        ...transcriptionData,
        subtitleChunks: newChunks,
        maxWordsPerChunk: value,
      });
    }
  };

  // Handle transcription chunks update
  const handleChunksUpdate = (updatedChunks: SubtitleChunk[]) => {
    if (!transcriptionData) return;
    setTranscriptionData({
      ...transcriptionData,
      subtitleChunks: updatedChunks,
    });
  };

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      try {
        const polledStatus = await fetchAndProcess();
        if (polledStatus === "completed" || polledStatus === "failed") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          if (polledStatus === "completed") {
            toast.success("Transcription completed!");
          }
        }
      } catch {
        // silently retry on next interval
      }
    }, 3000);
  }, [fetchAndProcess]);

  // Trigger the transcription job for a draft record and begin polling
  const startTranscription = useCallback(
    async (options?: { language?: string; maxWordsPerChunk?: number }) => {
    setIsStarting(true);
    try {
      const result = await startTranscriptionApi(transcriptionId, options);
      if (!result.success) {
        throw new Error(result.error || "Failed to start transcription");
      }
      setTranscriptionStatus("pending");
      toast.success("Transcription started!");
      startPolling();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to start transcription",
      );
    } finally {
      setIsStarting(false);
    }
    },
    [transcriptionId, startTranscriptionApi, startPolling],
  );

  return {
    transcriptionData,
    isLoading,
    isStarting,
    notFound,
    transcriptionStatus,
    startTranscription,
    handleMaxWordsChange,
    handleChunksUpdate,
    refreshTranscriptionData,
    setTranscriptionData,
  };
};
