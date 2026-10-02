"use client";

import { useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Subtitles,
  Trash,
  Waveform,
  Plus,
  GitMerge,
} from "@phosphor-icons/react";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { TranscriptionStatus } from "@/hooks/subtitle/use-transcription-data";
import type { SubtitleChunk } from "@/remotion/types";

export const TRANSCRIPTION_LANGUAGES: { code: string; label: string }[] = [
  { code: "auto", label: "Auto detect" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "hi", label: "Hindi" },
  { code: "ur", label: "Urdu" },
  { code: "ar", label: "Arabic" },
  { code: "ru", label: "Russian" },
  { code: "uk", label: "Ukrainian" },
  { code: "tr", label: "Turkish" },
  { code: "pl", label: "Polish" },
  { code: "id", label: "Indonesian" },
  { code: "vi", label: "Vietnamese" },
  { code: "th", label: "Thai" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
];

const WORDS_PER_LINE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function LanguageSelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)} disabled={disabled}>
      <SelectTrigger className={className ?? "h-8 w-36 text-xs"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TRANSCRIPTION_LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

function parseTimestamp(value: string): number {
  const parts = value.split(/[:.]/).map(Number);
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 1000;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

interface EditSubtitlesTabProps {
  videoUrl: string | null;
  transcriptionStatus: TranscriptionStatus;
  subtitleChunks: SubtitleChunk[];
  isStarting: boolean;
  activeChunkIndex?: number;
  language: string;
  onLanguageChange: (code: string) => void;
  maxWordsPerChunk: number;
  onMaxWordsChange: (value: number) => void;
  onStartTranscription: () => void;
  onChunksUpdate: (chunks: SubtitleChunk[]) => void;
  onSeekTo?: (timeInSeconds: number) => void;
}

export function EditSubtitlesTab({
  videoUrl,
  transcriptionStatus,
  subtitleChunks,
  isStarting,
  activeChunkIndex = -1,
  language,
  onLanguageChange,
  maxWordsPerChunk,
  onMaxWordsChange,
  onStartTranscription,
  onChunksUpdate,
  onSeekTo,
}: EditSubtitlesTabProps) {
  const isProcessing =
    transcriptionStatus === "pending" || transcriptionStatus === "processing";

  const activeRef = useRef<HTMLDivElement>(null);
  const lastScrolledIndex = useRef(-1);

  useEffect(() => {
    if (activeChunkIndex < 0 || activeChunkIndex === lastScrolledIndex.current)
      return;
    lastScrolledIndex.current = activeChunkIndex;
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeChunkIndex]);

  const updateChunk = useCallback(
    (index: number, field: "start" | "end" | "text", value: string) => {
      const updated = [...subtitleChunks];
      if (field === "text") {
        updated[index] = { ...updated[index], text: value };
      } else {
        updated[index] = {
          ...updated[index],
          [field]: parseTimestamp(value),
        };
      }
      onChunksUpdate(updated);
    },
    [subtitleChunks, onChunksUpdate],
  );

  const addChunk = useCallback(() => {
    const last = subtitleChunks[subtitleChunks.length - 1];
    const newChunk: SubtitleChunk = {
      text: "",
      start: last?.end ?? 0,
      end: (last?.end ?? 0) + 3,
      words: [],
    };
    onChunksUpdate([...subtitleChunks, newChunk]);
  }, [subtitleChunks, onChunksUpdate]);

  const removeChunk = useCallback(
    (index: number) => {
      onChunksUpdate(subtitleChunks.filter((_, i) => i !== index));
    },
    [subtitleChunks, onChunksUpdate],
  );

  const insertChunkAfter = useCallback(
    (index: number) => {
      const current = subtitleChunks[index];
      const next = subtitleChunks[index + 1];
      const start = current.end;
      const end = next ? next.start : current.end + 2;
      const newChunk: SubtitleChunk = { text: "", start, end, words: [] };
      const updated = [...subtitleChunks];
      updated.splice(index + 1, 0, newChunk);
      onChunksUpdate(updated);
    },
    [subtitleChunks, onChunksUpdate],
  );

  const mergeWithNext = useCallback(
    (index: number) => {
      if (index >= subtitleChunks.length - 1) return;
      const current = subtitleChunks[index];
      const next = subtitleChunks[index + 1];
      const merged: SubtitleChunk = {
        text: [current.text, next.text].filter(Boolean).join(" "),
        start: current.start,
        end: next.end,
        words: [...(current.words ?? []), ...(next.words ?? [])],
      };
      const updated = [...subtitleChunks];
      updated.splice(index, 2, merged);
      onChunksUpdate(updated);
    },
    [subtitleChunks, onChunksUpdate],
  );

  if (!videoUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <Subtitles className="size-8 text-muted-foreground/40" weight="thin" />
        <p className="text-sm text-muted-foreground">
          Upload a video first to edit subtitles
        </p>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Spinner className="size-7 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Transcribing your video...</h3>
          <p className="max-w-xs text-xs text-muted-foreground">
            This may take a minute. Subtitles will appear here once ready.
          </p>
        </div>
      </div>
    );
  }

  if (
    (transcriptionStatus === "draft" || transcriptionStatus === "failed") &&
    subtitleChunks.length === 0
  ) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Waveform className="size-7 text-primary" weight="duotone" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Transcribe your video</h3>
          <p className="max-w-xs text-xs text-muted-foreground">
            {transcriptionStatus === "failed"
              ? "Transcription failed. Try again."
              : "Automatically generate subtitles with timestamps from your video's audio"}
          </p>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Audio language
          </span>
          <LanguageSelect
            value={language}
            onChange={onLanguageChange}
            disabled={isStarting}
            className="h-9 w-44"
          />
        </div>
        <Button
          onClick={onStartTranscription}
          disabled={isStarting}
          className="gap-2"
        >
          {isStarting ? (
            <Spinner />
          ) : (
            <Waveform className="size-4" weight="bold" />
          )}
          {isStarting
            ? "Starting..."
            : transcriptionStatus === "failed"
              ? "Retry Transcription"
              : "Transcribe"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3  max-h-[70vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Subtitle Lines
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            ({subtitleChunks.length})
          </span>
        </h3>
        <Button
          variant="outline"
          size="xs"
          onClick={addChunk}
          className="gap-1.5"
        >
          <Plus className="size-3" weight="bold" />
          Add Line
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
        <LanguageSelect
          value={language}
          onChange={onLanguageChange}
          disabled={isStarting || isProcessing}
        />
        <Button
          variant="ghost"
          size="xs"
          onClick={onStartTranscription}
          disabled={isStarting || isProcessing}
          className="gap-1.5 text-xs"
        >
          {isStarting ? (
            <Spinner className="size-3.5" />
          ) : (
            <Waveform className="size-3.5" />
          )}
          {isStarting ? "Starting..." : "Re-transcribe"}
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Words per line</span>
          <Select
            value={String(maxWordsPerChunk)}
            onValueChange={(v) => v && onMaxWordsChange(Number(v))}
          >
            <SelectTrigger className="h-8 w-16 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORDS_PER_LINE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        {subtitleChunks.map((chunk, i) => (
          <div
            key={`${i}-${chunk.start}`}
            ref={i === activeChunkIndex ? activeRef : undefined}
          >
            {/* Chunk row */}
            <div
              className={`group relative rounded-lg px-2 transition-colors `}
            >
              <span className="mb-1 block text-[11px] tabular-nums text-muted-foreground">
                {formatTimestamp(chunk.start)} - {formatTimestamp(chunk.end)}
              </span>
              <div className="flex items-center gap-2">
                <Input
                  value={chunk.text}
                  onChange={(e) => updateChunk(i, "text", e.target.value)}
                  onFocus={() => onSeekTo?.(chunk.start)}
                  placeholder="Enter subtitle text..."
                  className={`h-10 flex-1 ${
                    i === activeChunkIndex
                      ? "bg-primary/8 ring-1 ring-primary/20"
                      : ""
                  }`}
                />
                <button
                  onClick={() => removeChunk(i)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive transition-opacity hover:bg-destructive/20 group-hover:opacity-100"
                >
                  <Trash className="size-4" />
                </button>
              </div>
            </div>

            {/* Between-row actions (visible on hover) */}
            {i < subtitleChunks.length - 1 && (
              <div className="group/between flex items-center justify-center gap-2 py-1.5">
                <div className="flex items-center gap-1.5 transition-opacity group-hover/between:opacity-100">
                  <button
                    onClick={() => insertChunkAfter(i)}
                    className="flex size-7 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="size-3.5" weight="bold" />
                  </button>
                  <button
                    onClick={() => mergeWithNext(i)}
                    className="flex h-7 items-center gap-1 rounded-md border bg-background px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <GitMerge className="size-3.5" />
                    Merge
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
