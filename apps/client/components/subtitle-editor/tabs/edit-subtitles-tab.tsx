"use client";

import { useMemo, useState } from "react";
import { SmileyWink, Sparkle, TextT, Waveform } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/shared/states";
import { CaptionLines } from "@/components/subtitle-editor/captions/caption-lines";
import { useCaptionsEditor } from "@/components/subtitle-editor/captions/captions-context";
import { FindReplacePopover } from "@/components/subtitle-editor/captions/find-replace-popover";
import {
  TranscribePopover,
  type TranscriptionOptions,
} from "@/components/subtitle-editor/captions/transcribe-popover";
import { TranslateDialog } from "@/components/subtitle-editor/captions/translate-dialog";
import {
  findPhrase,
  replacePhrase,
  type WordPosition,
} from "@/components/subtitle-editor/chunk-edits";
import { EditorSection } from "@/components/subtitle-editor/editor-fields";
import type { CaptionPass } from "@/components/subtitle-editor/editor/use-caption-tools";
import { failureMessage } from "@/components/subtitle-editor/format";
import type { TranscriptionStatus } from "@/hooks/subtitle/use-transcription-data";

interface CaptionsTabProps {
  hasVideo: boolean;
  status: TranscriptionStatus;
  transcriptionError: string | null;
  isStarting: boolean;
  /** The line on screen in the preview, or -1. */
  activeLineIndex: number;
  /** The word being spoken, for the karaoke fill. */
  activeWord: WordPosition | null;
  language: string;
  onStartTranscription: (options: TranscriptionOptions) => void;
  /** Whisper's confidence, 0 to 100, or null when unknown. */
  accuracy: number | null;
  /** Which AI pass is running, if any. */
  busy: CaptionPass | null;
  onOptimize: () => Promise<void>;
  onRegenerateEmojis: () => Promise<void>;
  /** Resolves true once translated. */
  onTranslate: (language: string) => Promise<boolean>;
  onOpenHookTitle: () => void;
}

/**
 * Submagic's Captions tab. Shows one of four screens: no video, transcribing,
 * not transcribed yet, or the transcript with its tools.
 */
export function CaptionsTab(props: CaptionsTabProps) {
  const { hasVideo, status, transcriptionError, isStarting, language, onStartTranscription } =
    props;
  const { chunks } = useCaptionsEditor();
  const isTranscribing = status === "pending" || status === "processing";
  const notTranscribedYet = (status === "draft" || status === "failed") && chunks.length === 0;

  if (!hasVideo) {
    return (
      <EmptyState
        icon={Waveform}
        title="No video"
        description="This project has no video to transcribe."
      />
    );
  }

  if (isTranscribing) return <TranscribingNotice />;

  if (notTranscribedYet) {
    return (
      <EditorSection
        title="Transcribe video"
        description="Creates timed caption lines from the audio."
        actions={
          <TranscribePopover
            language={language}
            hasLines={false}
            isStarting={isStarting}
            onStart={onStartTranscription}
            variant="default"
          />
        }
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

  return <Transcript {...props} />;
}

function TranscribingNotice() {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 rounded-lg bg-muted py-16 text-center"
    >
      <Spinner aria-hidden className="size-5 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Transcribing</p>
        <p className="text-xs text-muted-foreground">This usually takes about a minute.</p>
      </div>
    </div>
  );
}

/** The transcript: a toolbar, the accuracy bar, and the caption lines. */
function Transcript({
  isStarting,
  activeLineIndex,
  activeWord,
  language,
  onStartTranscription,
  accuracy,
  busy,
  onOptimize,
  onRegenerateEmojis,
  onTranslate,
  onOpenHookTitle,
}: CaptionsTabProps) {
  const { chunks, onChunksChange, preset } = useCaptionsEditor();
  /** The Find and replace search text. */
  const [find, setFind] = useState("");

  // Memoized: a new Set on every render would re-render every caption line.
  const matches = useMemo(
    () => (find.trim() ? findPhrase(chunks, find) : []),
    [chunks, find],
  );
  const matchKeys = useMemo(
    () =>
      new Set(
        matches.flatMap(({ lineIndex, wordIndex, length }) =>
          Array.from({ length }, (_, k) => `${lineIndex}:${wordIndex + k}`),
        ),
      ),
    [matches],
  );

  const hasEmojis = chunks.some((c) => c.emoji || c.words.some((w) => w.emoji));
  const suggestEmojis = Boolean(preset.emojis) && !hasEmojis;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onOpenHookTitle}>
          <TextT />
          Hook Title
        </Button>
        <TranslateDialog onTranslate={onTranslate} />
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={onRegenerateEmojis}>
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
        <div className="ml-auto">
          <TranscribePopover
            language={language}
            hasLines={chunks.length > 0}
            isStarting={isStarting}
            onStart={onStartTranscription}
            variant="outline"
          />
        </div>
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
        <Button size="sm" variant="secondary" disabled={busy !== null} onClick={onOptimize}>
          {busy === "optimize" ? <Spinner /> : <Sparkle />}
          Optimize
        </Button>
      </div>

      {suggestEmojis ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
          <p className="text-sm text-muted-foreground">
            This style shows emojis. Let AI pick them, or add one to a line.
          </p>
          <Button size="sm" disabled={busy !== null} onClick={onRegenerateEmojis}>
            {busy === "emojis" ? <Spinner /> : <SmileyWink />}
            Pick emojis
          </Button>
        </div>
      ) : null}

      <CaptionLines
        activeLineIndex={activeLineIndex}
        activeWord={activeWord}
        matches={matchKeys}
      />
    </div>
  );
}
