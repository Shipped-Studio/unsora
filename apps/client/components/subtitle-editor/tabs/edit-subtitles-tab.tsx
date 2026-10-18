"use client";

import { useId, useState } from "react";
import { Plus, Waveform } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/shared/states";
import { CaptionLines } from "@/components/subtitle-editor/caption-lines";
import { EditorSection } from "@/components/subtitle-editor/editor-fields";
import { failureMessage } from "@/components/subtitle-editor/format";
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

function LabelledSelect({
  label,
  value,
  items,
  onChange,
  className,
}: {
  label: string;
  value: string;
  items: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const labelId = useId();
  return (
    // flex gap, not space-y: Base UI renders a hidden <input> after the
    // trigger, so space-y would add a bottom margin to the trigger.
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

export interface TranscriptionOptions {
  language: string;
}

/**
 * Language lives here; it only matters when transcribing. Lines are split
 * at sentence ends, commas and pauses, so there's no words-per-line setting.
 */
function TranscribePopover({
  language,
  hasLines,
  isStarting,
  onStart,
  variant,
}: {
  language: string;
  hasLines: boolean;
  isStarting: boolean;
  onStart: (options: TranscriptionOptions) => void;
  variant: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const [draftLanguage, setDraftLanguage] = useState(language);
  const label = hasLines ? "Transcribe again" : "Transcribe";

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDraftLanguage(language);
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger
        render={<Button variant={variant} disabled={isStarting} />}
      >
        {isStarting ? <Spinner /> : <Waveform />}
        {isStarting ? "Starting…" : label}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80">
        <PopoverHeader>
          <PopoverTitle>{label}</PopoverTitle>
          <PopoverDescription>
            {hasLines
              ? "The new transcript replaces every line, including your edits."
              : "Creates timed subtitle lines from the audio."}
          </PopoverDescription>
        </PopoverHeader>
        <LabelledSelect
          label="Audio language"
          value={draftLanguage}
          items={LANGUAGE_ITEMS}
          onChange={setDraftLanguage}
          className="w-full"
        />
        <Button
          variant={hasLines ? "destructive" : "default"}
          className="w-full"
          onClick={() => {
            setOpen(false);
            onStart({ language: draftLanguage });
          }}
        >
          <Waveform />
          {label}
        </Button>
      </PopoverContent>
    </Popover>
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
  onStartTranscription: (options: TranscriptionOptions) => void;
  onChunksChange: (chunks: SubtitleChunk[]) => void;
  onSeek: (seconds: number) => void;
  /** Plays a short moment from `seconds`. */
  onPlayFrom: (seconds: number) => void;
}

export function EditSubtitlesTab({
  hasVideo,
  status,
  transcriptionError,
  chunks,
  isStarting,
  activeChunkIndex,
  language,
  onStartTranscription,
  onChunksChange,
  onSeek,
  onPlayFrom,
}: EditSubtitlesTabProps) {
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

  const transcribe = (variant: "default" | "outline") => (
    <TranscribePopover
      language={language}
      hasLines={chunks.length > 0}
      isStarting={isStarting}
      onStart={onStartTranscription}
      variant={variant}
    />
  );

  if ((status === "draft" || status === "failed") && chunks.length === 0) {
    return (
      <EditorSection
        title="Transcribe video"
        description="Creates timed subtitle lines from the audio."
        actions={transcribe("default")}
      >
        {status === "failed" ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {failureMessage("transcribe this video", transcriptionError)}
          </p>
        ) : (
          <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
            No subtitles yet. Transcribe the video to get started.
          </p>
        )}
      </EditorSection>
    );
  }

  return (
    <EditorSection
      title="Subtitles"
      description={`${chunks.length} ${chunks.length === 1 ? "line" : "lines"}. Click a word to edit, retime or move it.`}
      actions={
        <>
          {transcribe("outline")}
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
        </>
      }
    >
      <CaptionLines
        chunks={chunks}
        activeChunkIndex={activeChunkIndex}
        onChunksChange={onChunksChange}
        onSeek={onSeek}
        onPlayFrom={onPlayFrom}
      />
    </EditorSection>
  );
}
