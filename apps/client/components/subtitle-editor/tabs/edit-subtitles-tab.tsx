"use client";

import { useId, useState } from "react";
import {
  MagnifyingGlass,
  SmileyWink,
  Sparkle,
  TextT,
  Translate,
  Waveform,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type {
  CaptionPlacement,
  SubtitleStylePreset,
} from "@/components/subtitle-editor/caption-style";
import { findPhrase, replacePhrase } from "@/components/subtitle-editor/chunk-edits";
import { EditorSection } from "@/components/subtitle-editor/editor-fields";
import { HookTitleEditor } from "@/components/subtitle-editor/tabs/edit-title-tab";
import type { TitleOverlayConfig } from "@/components/subtitle-editor/title-overlay";
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

const FLAGS: Record<string, string> = {
  en: "🇬🇧", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪", it: "🇮🇹", pt: "🇵🇹", nl: "🇳🇱",
  hi: "🇮🇳", ur: "🇵🇰", ar: "🇸🇦", ru: "🇷🇺", uk: "🇺🇦", tr: "🇹🇷", pl: "🇵🇱",
  id: "🇮🇩", vi: "🇻🇳", th: "🇹🇭", ja: "🇯🇵", ko: "🇰🇷", zh: "🇨🇳",
};

const TRANSLATE_ITEMS = TRANSCRIPTION_LANGUAGES.filter((l) => l.code !== "auto").map(
  (l) => ({ value: l.label, label: `${FLAGS[l.code] ?? ""} ${l.label}`.trim() }),
);
const TRANSLATE_CREDITS = 1;

interface CaptionsTabProps {
  hasVideo: boolean;
  status: TranscriptionStatus;
  transcriptionError: string | null;
  chunks: SubtitleChunk[];
  isStarting: boolean;
  activeChunkIndex: number;
  activeWord: { c: number; w: number } | null;
  language: string;
  onStartTranscription: (options: TranscriptionOptions) => void;
  onChunksChange: (chunks: SubtitleChunk[]) => void;
  onSeek: (seconds: number) => void;
  preset: SubtitleStylePreset;
  placement: CaptionPlacement;
  templates: SubtitleStylePreset[];
  /** Whisper's confidence, 0 to 100, or null when unknown. */
  accuracy: number | null;
  onOptimize: () => Promise<void>;
  onRegenerateEmojis: () => Promise<void>;
  /** Resolves true once translated. */
  onTranslate: (language: string) => Promise<boolean>;
  titleOverlay: TitleOverlayConfig;
  onTitleOverlayChange: (config: TitleOverlayConfig) => void;
  onGenerateHook: (previousHooks: string[]) => Promise<string | null>;
  canGenerateHook: boolean;
  getCurrentTime: () => number;
  /** The transcript, or the hook title editor. */
  view: "captions" | "hook";
  onViewChange: (view: "captions" | "hook") => void;
}

/** Submagic's Captions tab: the transcript, its tools and the hook title. */
export function CaptionsTab({
  hasVideo,
  status,
  transcriptionError,
  chunks,
  isStarting,
  activeChunkIndex,
  activeWord,
  language,
  onStartTranscription,
  onChunksChange,
  onSeek,
  preset,
  placement,
  templates,
  accuracy,
  onOptimize,
  onRegenerateEmojis,
  onTranslate,
  titleOverlay,
  onTitleOverlayChange,
  onGenerateHook,
  canGenerateHook,
  getCurrentTime,
  view,
  onViewChange: setView,
}: CaptionsTabProps) {
  const [busy, setBusy] = useState<"optimize" | "emojis" | null>(null);
  const [find, setFind] = useState("");
  const isTranscribing = status === "pending" || status === "processing";
  const matches = find.trim() ? findPhrase(chunks, find) : [];
  const matchKeys = new Set(
    matches.flatMap(({ c, w, length }) =>
      Array.from({ length }, (_, k) => `${c}:${w + k}`),
    ),
  );

  if (view === "hook") {
    return (
      <HookTitleEditor
        config={titleOverlay}
        onChange={onTitleOverlayChange}
        onGenerate={onGenerateHook}
        canGenerate={canGenerateHook}
        getCurrentTime={getCurrentTime}
        onBack={() => setView("captions")}
      />
    );
  }

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
        description="Creates timed caption lines from the audio."
        actions={transcribe("default")}
      >
        {status === "failed" ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {failureMessage("transcribe this video", transcriptionError)}
          </p>
        ) : (
          <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
            No captions yet. Transcribe the video to get started.
          </p>
        )}
      </EditorSection>
    );
  }

  const run = async (kind: "optimize" | "emojis") => {
    setBusy(kind);
    await (kind === "optimize" ? onOptimize() : onRegenerateEmojis());
    setBusy(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setView("hook")}>
          <TextT />
          Hook Title
        </Button>
        <TranslateDialog onTranslate={onTranslate} />
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => run("emojis")}
        >
          {busy === "emojis" ? <Spinner /> : <SmileyWink />}
          Regenerate Emojis
        </Button>
        <FindReplacePopover
          find={find}
          onFindChange={setFind}
          matchCount={matches.length}
          onReplaceAll={(replacement) => {
            onChunksChange(replacePhrase(chunks, find, replacement));
            setFind("");
          }}
        />
        <div className="ml-auto">{transcribe("outline")}</div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2">
        <p className="text-sm">
          {accuracy !== null ? (
            <>
              Captions accuracy{" "}
              <span className="font-medium tabular-nums">{accuracy.toFixed(1)}%</span>
            </>
          ) : (
            <span className="text-muted-foreground">
              {chunks.length} {chunks.length === 1 ? "line" : "lines"}
            </span>
          )}
        </p>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy !== null}
          onClick={() => run("optimize")}
        >
          {busy === "optimize" ? <Spinner /> : <Sparkle />}
          Optimize
        </Button>
      </div>

      {preset.emojis && !chunks.some((c) => c.emoji || c.words.some((w) => w.emoji)) ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
          <p className="text-sm text-muted-foreground">
            This style shows emojis. Let AI pick them, or add one to a line.
          </p>
          <Button size="sm" disabled={busy !== null} onClick={() => run("emojis")}>
            {busy === "emojis" ? <Spinner /> : <SmileyWink />}
            Pick emojis
          </Button>
        </div>
      ) : null}

      <CaptionLines
        chunks={chunks}
        activeChunkIndex={activeChunkIndex}
        activeWord={activeWord}
        onChunksChange={onChunksChange}
        onSeek={onSeek}
        preset={preset}
        placement={placement}
        templates={templates}
        matches={matchKeys}
      />
    </div>
  );
}

function FindReplacePopover({
  find,
  onFindChange,
  matchCount,
  onReplaceAll,
}: {
  find: string;
  onFindChange: (find: string) => void;
  matchCount: number;
  onReplaceAll: (replacement: string) => void;
}) {
  const findId = useId();
  const replaceId = useId();
  const [open, setOpen] = useState(false);
  const [replacement, setReplacement] = useState("");

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onFindChange("");
      }}
    >
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <MagnifyingGlass />
        Find and replace
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-80">
        <PopoverHeader>
          <PopoverTitle>Find and replace</PopoverTitle>
          <PopoverDescription>
            Replaces a word or phrase across the transcript.
          </PopoverDescription>
        </PopoverHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!matchCount) return;
            onReplaceAll(replacement);
            setReplacement("");
            setOpen(false);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={findId}>Find</Label>
            <Input
              id={findId}
              autoFocus
              value={find}
              onChange={(event) => onFindChange(event.target.value)}
            />
            {find.trim() ? (
              <p className="text-xs text-muted-foreground">
                {matchCount} {matchCount === 1 ? "match" : "matches"}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={replaceId}>Replace with</Label>
            <Input
              id={replaceId}
              value={replacement}
              onChange={(event) => setReplacement(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={!matchCount}>
            Replace all
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function TranslateDialog({
  onTranslate,
}: {
  onTranslate: (language: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState(TRANSLATE_ITEMS[2].value);
  const [isTranslating, setIsTranslating] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(next) => !isTranslating && setOpen(next)}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Translate />
        Translate
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Translate your video</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm">Language</span>
            <div className="w-56">
              <Select
                items={TRANSLATE_ITEMS}
                value={language}
                onValueChange={(next) => {
                  if (typeof next === "string") setLanguage(next);
                }}
              >
                <SelectTrigger aria-label="Language" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSLATE_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isTranslating} />}>
            Cancel
          </DialogClose>
          <Button
            disabled={isTranslating}
            onClick={async () => {
              setIsTranslating(true);
              const done = await onTranslate(language);
              setIsTranslating(false);
              if (done) setOpen(false);
            }}
          >
            {isTranslating ? <Spinner /> : null}
            Translate
            <span className="rounded bg-primary-foreground/20 px-1.5 text-xs tabular-nums">
              ✦ {TRANSLATE_CREDITS}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
