import { useState } from "react";
import { toast } from "sonner";
import {
  attachPunctuation,
  resplitChunks,
  sameCaptionCuts,
  type CaptionLayout,
} from "@/components/subtitle-editor/caption-layout";
import { presetLayout, presetPlacement } from "@/components/subtitle-editor/caption-style";
import { applyCaptionMarkup, replaceLineWords } from "@/components/subtitle-editor/chunk-edits";
import type { EditorSettings } from "@/components/subtitle-editor/editor/use-editor-settings";
import { failureMessage } from "@/components/subtitle-editor/format";
import type { SubtitleStylePreset } from "@/components/subtitle-editor/style-presets";
import { useSubtitleApi } from "@/hooks/subtitle/use-subtitle-api";
import type { SubtitleChunk, TranscriptionData } from "@/remotion/types";

/**
 * Edits to the caption lines as a whole: switching template (which may
 * re-cut the lines), AI emojis, AI optimize and translation.
 */
export function useCaptionTools({
  project,
  chunks,
  onChunksChange,
  settings,
  isTranscribing,
}: {
  project: TranscriptionData;
  chunks: SubtitleChunk[];
  onChunksChange: (chunks: SubtitleChunk[]) => void;
  settings: EditorSettings;
  isTranscribing: boolean;
}) {
  const api = useSubtitleApi();
  const { preset, setPreset, placement, setPlacement } = settings;
  /** Set once the user chooses to keep hand-edited lines over a style's cut. */
  const [keepLines, setKeepLines] = useState(false);
  /** A template waiting for the user to decide whether to re-cut the lines. */
  const [pendingPreset, setPendingPreset] = useState<SubtitleStylePreset | null>(null);
  /**
   * Which AI pass is running, so its button shows a spinner and both are
   * disabled. Kept here, not in the tab, so it survives switching to the
   * hook title and back mid-request; otherwise the request could be sent twice.
   */
  const [busy, setBusy] = useState<CaptionPass | null>(null);

  const runPass = (pass: CaptionPass, request: () => Promise<void>) => async () => {
    setBusy(pass);
    try {
      await request();
    } finally {
      setBusy(null);
    }
  };

  /** The lines cut again for `layout`. */
  const recut = (list: SubtitleChunk[], layout: CaptionLayout) =>
    resplitChunks(withPunctuation(list, project.text ?? ""), layout);

  /** True when the lines are exactly as `layout` would cut them. */
  const linesUntouched = (layout: CaptionLayout) =>
    sameCaptionCuts(chunks, recut(chunks, layout));

  /**
   * Switches template. Each template cuts lines its own way, so the lines
   * are re-cut, unless the user edited them by hand: then they're asked.
   */
  const changePreset = (next: SubtitleStylePreset) => {
    // A different template brings its own size and position, as in Submagic.
    if (next.id !== preset.id) {
      setPlacement(presetPlacement(next, placement.width));
    }
    const before = presetLayout(preset);
    const after = presetLayout(next);
    const layoutChanged = JSON.stringify(before) !== JSON.stringify(after);
    if (!layoutChanged || keepLines || isTranscribing || !chunks.length) {
      setPreset(next);
      return;
    }
    if (linesUntouched(before)) {
      setPreset(next);
      onChunksChange(recut(chunks, after));
      return;
    }
    setPendingPreset(next);
  };

  /** The answers to the "Re-cut the lines?" question. */
  const pendingRecut = {
    preset: pendingPreset,
    recut: () => {
      if (!pendingPreset) return;
      setPreset(pendingPreset);
      onChunksChange(recut(chunks, presetLayout(pendingPreset)));
      setPendingPreset(null);
    },
    keepLines: () => {
      if (pendingPreset) setPreset(pendingPreset);
      setKeepLines(true);
      setPendingPreset(null);
    },
    cancel: () => setPendingPreset(null),
  };

  /** A new transcript replaces hand-edited lines, so the earlier choice is dropped. */
  const forgetKeepLines = () => setKeepLines(false);

  /** Re-runs the AI emoji picks; a transcript with no highlights gets those too. */
  const regenerateEmojis = async () => {
    const words = chunks.flatMap((c) => c.words.map((w) => w.word));
    if (!words.length) return;
    const untouched = !keepLines && linesUntouched(presetLayout(preset));
    const result = await api.findCaptionKeywords(project.id, words);
    if (!result.success || !result.data) {
      toast.error(failureMessage("pick emojis", result.error));
      return;
    }
    const hasHighlights = chunks.some((c) => c.words.some((w) => w.keyword));
    const current = chunks.flatMap((c) => c.words);
    const marked = applyCaptionMarkup(chunks, {
      emojis: result.data.emojis,
      keywords: hasHighlights
        ? current.flatMap((w, index) => (w.keyword ? [{ index, level: w.keyword }] : []))
        : result.data.keywords,
    });
    // Solo keywords depend on highlights, so untouched lines are re-cut.
    onChunksChange(
      untouched && !hasHighlights ? recut(marked, presetLayout(preset)) : marked,
    );
    toast.success(`Picked ${result.data.emojis.length} emojis`);
  };

  /** AI fixes transcription mistakes, keeping each line's words in place. */
  const optimize = async () => {
    const result = await api.optimizeCaptions(
      project.id,
      chunks.map((c) => c.words.map((w) => w.word)),
    );
    if (!result.success || !result.data) {
      toast.error(failureMessage("optimize the captions", result.error));
      return;
    }
    const before = chunks.map((c) => c.words.map((w) => w.word).join(" "));
    const changed = result.data.lines.filter((line, i) => line.join(" ") !== before[i]).length;
    onChunksChange(replaceLineWords(chunks, result.data.lines));
    toast.success(
      changed ? `Fixed ${changed} ${changed === 1 ? "line" : "lines"}` : "No mistakes found",
    );
  };

  /** Translates every line. Resolves true once translated. */
  const translate = async (targetLanguage: string) => {
    const result = await api.translateCaptions(
      project.id,
      targetLanguage,
      chunks.map((c) => c.words.map((w) => w.word).join(" ")),
    );
    if (!result.success || !result.data) {
      toast.error(failureMessage("translate the captions", result.error));
      return false;
    }
    const translated = replaceLineWords(
      chunks,
      result.data.lines.map((line) => line.split(/\s+/)),
    ).map((chunk) => ({
      ...chunk,
      // The highlights and emojis were for the old words.
      words: chunk.words.map((word) => {
        const fresh = { ...word };
        delete fresh.keyword;
        delete fresh.emoji;
        delete fresh.punctuation;
        return fresh;
      }),
    }));
    onChunksChange(recut(translated, presetLayout(preset)));
    toast.success(`Translated to ${targetLanguage}`);
    return true;
  };

  return {
    changePreset,
    pendingRecut,
    forgetKeepLines,
    busy,
    regenerateEmojis: runPass("emojis", regenerateEmojis),
    optimize: runPass("optimize", optimize),
    translate,
    accuracy: transcriptAccuracy(project),
  };
}

/** The AI passes over the whole transcript that show a busy state. */
export type CaptionPass = "optimize" | "emojis";

/** Older transcripts have no punctuation on their words; it's read from the text. */
function withPunctuation(list: SubtitleChunk[], text: string): SubtitleChunk[] {
  if (list.some((c) => c.words.some((w) => w.punctuation !== undefined))) {
    return list;
  }
  const words = attachPunctuation(list.flatMap((c) => c.words), text);
  let index = 0;
  return list.map((chunk) => ({
    ...chunk,
    words: chunk.words.map(() => words[index++]),
  }));
}

/** Whisper's confidence as a percentage, weighted by segment length; null if unknown. */
function transcriptAccuracy(project: TranscriptionData): number | null {
  const scored = (project.segments ?? []).filter((s) => typeof s.confidence === "number");
  const total = scored.reduce((n, s) => n + (s.end - s.start), 0);
  if (!total) return null;
  return (scored.reduce((n, s) => n + s.confidence! * (s.end - s.start), 0) / total) * 100;
}
