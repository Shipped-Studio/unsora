"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowsMerge,
  DotsThreeVertical,
  Plus,
  Trash,
  Waveform,
} from "@phosphor-icons/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/shared/states";
import { EditorSection } from "@/components/subtitle-editor/editor-fields";
import {
  failureMessage,
  formatTimestamp,
} from "@/components/subtitle-editor/format";
import type { TranscriptionStatus } from "@/hooks/subtitle/use-transcription-data";
import type { SubtitleChunk } from "@/remotion/types";

export const TRANSCRIPTION_LANGUAGES: { code: string; label: string }[] = [
  { code: "auto", label: "Detect automatically" },
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

const LANGUAGE_ITEMS = TRANSCRIPTION_LANGUAGES.map((l) => ({
  value: l.code,
  label: l.label,
}));

const WORDS_PER_LINE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const WORDS_PER_LINE_ITEMS = WORDS_PER_LINE.map((n) => ({
  value: String(n),
  label: String(n),
}));

function LabelledSelect({
  label,
  value,
  items,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: string;
  items: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const labelId = useId();
  return (
    // flex gap, not space-y: Base UI renders a hidden <input> after the
    // trigger, so space-y would add a bottom margin to the trigger and push
    // items-end siblings (the Transcribe again button) below it.
    <div className="flex flex-col gap-2">
      <span id={labelId} className="block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => {
          if (typeof next === "string") onChange(next);
        }}
        disabled={disabled}
      >
        <SelectTrigger aria-labelledby={labelId} className={className}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface EditSubtitlesTabProps {
  hasVideo: boolean;
  status: TranscriptionStatus;
  transcriptionError: string | null;
  chunks: SubtitleChunk[];
  isStarting: boolean;
  activeChunkIndex: number;
  language: string;
  onLanguageChange: (code: string) => void;
  maxWordsPerChunk: number;
  onMaxWordsChange: (value: number) => void;
  onStartTranscription: () => void;
  onChunksChange: (chunks: SubtitleChunk[]) => void;
  onSeek: (seconds: number) => void;
}

export function EditSubtitlesTab({
  hasVideo,
  status,
  transcriptionError,
  chunks,
  isStarting,
  activeChunkIndex,
  language,
  onLanguageChange,
  maxWordsPerChunk,
  onMaxWordsChange,
  onStartTranscription,
  onChunksChange,
  onSeek,
}: EditSubtitlesTabProps) {
  const [confirmRetranscribe, setConfirmRetranscribe] = useState(false);
  const isTranscribing = status === "pending" || status === "processing";

  if (!hasVideo) {
    return (
      <EmptyState
        icon={Waveform}
        title="No video"
        description="This project has no video to transcribe."
      />
    );
  }

  if (isTranscribing) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-3 rounded-lg bg-muted py-16 text-center"
      >
        <Spinner aria-hidden className="size-5 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Transcribing</p>
          <p className="text-xs text-muted-foreground">
            This usually takes about a minute.
          </p>
        </div>
      </div>
    );
  }

  const languageSelect = (
    <LabelledSelect
      label="Audio language"
      value={language}
      items={LANGUAGE_ITEMS}
      onChange={onLanguageChange}
      disabled={isStarting}
      className="w-48"
    />
  );

  const wordsSelect = (
    <LabelledSelect
      label="Words per line"
      value={String(maxWordsPerChunk)}
      items={WORDS_PER_LINE_ITEMS}
      onChange={(value) => onMaxWordsChange(Number(value))}
      className="w-20"
    />
  );

  if ((status === "draft" || status === "failed") && chunks.length === 0) {
    return (
      <EditorSection
        title="Transcribe video"
        description="Creates timed subtitle lines from the audio."
      >
        {status === "failed" ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {failureMessage("transcribe this video", transcriptionError)}
          </p>
        ) : null}
        <div className="flex flex-wrap items-end gap-4">
          {languageSelect}
          {wordsSelect}
        </div>
        <Button onClick={onStartTranscription} disabled={isStarting}>
          {isStarting ? <Spinner /> : <Waveform />}
          {isStarting
            ? "Starting…"
            : status === "failed"
              ? "Try again"
              : "Transcribe"}
        </Button>
      </EditorSection>
    );
  }

  return (
    <EditorSection
      title="Subtitles"
      description={`${chunks.length} ${chunks.length === 1 ? "line" : "lines"}. Click a timestamp to jump to it.`}
      actions={
        <Button
          variant="outline"
          onClick={() => {
            const last = chunks[chunks.length - 1];
            const start = last?.end ?? 0;
            onChunksChange([
              ...chunks,
              { text: "", start, end: start + 3, words: [] },
            ]);
          }}
        >
          <Plus />
          Add line
        </Button>
      }
    >
      <div className="flex flex-wrap items-end gap-4 rounded-xl bg-muted p-3">
        {languageSelect}
        <Button
          variant="outline"
          disabled={isStarting}
          onClick={() => setConfirmRetranscribe(true)}
        >
          {isStarting ? <Spinner /> : <Waveform />}
          {isStarting ? "Starting…" : "Transcribe again"}
        </Button>
        <div className="sm:ml-auto">{wordsSelect}</div>
      </div>

      <ChunkList
        chunks={chunks}
        activeChunkIndex={activeChunkIndex}
        onChunksChange={onChunksChange}
        onSeek={onSeek}
      />

      <AlertDialog
        open={confirmRetranscribe}
        onOpenChange={setConfirmRetranscribe}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transcribe again?</AlertDialogTitle>
            <AlertDialogDescription>
              The new transcript replaces every subtitle line, including your
              edits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmRetranscribe(false);
                onStartTranscription();
              }}
            >
              Transcribe again
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EditorSection>
  );
}

function ChunkList({
  chunks,
  activeChunkIndex,
  onChunksChange,
  onSeek,
}: {
  chunks: SubtitleChunk[];
  activeChunkIndex: number;
  onChunksChange: (chunks: SubtitleChunk[]) => void;
  onSeek: (seconds: number) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);

  // Follow playback, but only while the list is on screen and the user
  // isn't typing in it.
  useEffect(() => {
    const list = listRef.current;
    if (!list || activeChunkIndex < 0) return;
    const focused = document.activeElement;
    if (focused instanceof HTMLInputElement && list.contains(focused)) return;
    const rect = list.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    list
      .querySelector<HTMLElement>(`[data-chunk-index="${activeChunkIndex}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeChunkIndex]);

  const updateText = (index: number, text: string) => {
    const next = [...chunks];
    next[index] = { ...next[index], text };
    onChunksChange(next);
  };

  const insertAfter = (index: number) => {
    const current = chunks[index];
    const following = chunks[index + 1];
    const next = [...chunks];
    next.splice(index + 1, 0, {
      text: "",
      start: current.end,
      end: following ? following.start : current.end + 2,
      words: [],
    });
    onChunksChange(next);
  };

  const mergeWithNext = (index: number) => {
    const current = chunks[index];
    const following = chunks[index + 1];
    if (!following) return;
    const next = [...chunks];
    next.splice(index, 2, {
      text: [current.text, following.text].filter(Boolean).join(" "),
      start: current.start,
      end: following.end,
      words: [...(current.words ?? []), ...(following.words ?? [])],
    });
    onChunksChange(next);
  };

  const remove = (index: number) =>
    onChunksChange(chunks.filter((_, i) => i !== index));

  if (chunks.length === 0) {
    return (
      <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
        No subtitle lines. Add one or transcribe again.
      </p>
    );
  }

  return (
    <ol ref={listRef} className="space-y-1">
      {chunks.map((chunk, index) => {
        const isActive = index === activeChunkIndex;
        const lineNumber = index + 1;
        return (
          <li
            key={`${index}-${chunk.start}`}
            data-chunk-index={index}
            data-active={isActive}
            className="scroll-mt-32 scroll-mb-4 rounded-lg p-2 transition-colors data-[active=true]:bg-muted"
          >
            <button
              type="button"
              onClick={() => onSeek(chunk.start)}
              aria-label={`Play line ${lineNumber} from ${formatTimestamp(chunk.start)}`}
              className="mb-1.5 rounded-sm text-xs tabular-nums text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {formatTimestamp(chunk.start)} – {formatTimestamp(chunk.end)}
            </button>
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Line ${lineNumber}`}
                value={chunk.text}
                onChange={(event) => updateText(index, event.target.value)}
                onFocus={() => onSeek(chunk.start)}
                placeholder="Subtitle text"
                className="bg-background"
              />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for line ${lineNumber}`}
                    />
                  }
                >
                  <DotsThreeVertical />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => insertAfter(index)}>
                    <Plus />
                    Insert line below
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={index === chunks.length - 1}
                    onClick={() => mergeWithNext(index)}
                  >
                    <ArrowsMerge />
                    Merge with next line
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => remove(index)}
                  >
                    <Trash />
                    Delete line
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
