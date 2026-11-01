import { useCallback, useRef, useState } from "react";
import type { WordPosition } from "@/components/subtitle-editor/chunk-edits";
import type { SeekFn } from "@/components/subtitle-editor/video-preview";
import type { SubtitleChunk } from "@/remotion/types";

/**
 * Where the preview is playing, in caption terms.
 *
 * The time itself changes 30 times a second, so it lives in a ref, not
 * state. Only the playing line and word are state: the editor re-renders
 * when they change, not on every frame.
 */
export function usePlayback(chunks: SubtitleChunk[]) {
  const currentTimeRef = useRef(0);
  /** Filled in by VideoPreview once its player is ready. */
  const seekRef = useRef<SeekFn | null>(null);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const [activeWord, setActiveWord] = useState<WordPosition | null>(null);

  /** VideoPreview calls this on every frame, with the source-video time. */
  const onTimeUpdate = useCallback(
    (time: number) => {
      currentTimeRef.current = time;
      const lineIndex = chunks.findIndex((c) => time >= c.start && time < c.end);
      setActiveLineIndex(lineIndex);
      const wordIndex =
        lineIndex < 0
          ? -1
          : chunks[lineIndex].words.findIndex((w) => time >= w.start && time < w.end);
      // Keep the same object while the word is unchanged, so React skips the render.
      setActiveWord((prev) => {
        if (wordIndex < 0) return null;
        if (prev?.lineIndex === lineIndex && prev.wordIndex === wordIndex) return prev;
        return { lineIndex, wordIndex };
      });
    },
    [chunks],
  );

  const seek = useCallback((seconds: number) => seekRef.current?.(seconds), []);
  const getCurrentTime = useCallback(() => currentTimeRef.current, []);

  return { activeLineIndex, activeWord, onTimeUpdate, seek, seekRef, getCurrentTime };
}
