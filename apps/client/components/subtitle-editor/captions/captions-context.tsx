"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type {
  CaptionPlacement,
  SubtitleStylePreset,
} from "@/components/subtitle-editor/caption-style";
import type { SubtitleChunk } from "@/remotion/types";

/**
 * What every part of the Captions tab needs: the caption lines, a way to
 * change them, a way to jump the preview, and the project's style.
 *
 * Shared through context so it isn't passed down through every component.
 * The playing word is deliberately NOT here: it changes several times a
 * second, and every component reading this context would re-render with it.
 */
interface CaptionsEditorValue {
  chunks: SubtitleChunk[];
  onChunksChange: (chunks: SubtitleChunk[]) => void;
  /** Jumps the preview to a time in the source video. */
  onSeek: (seconds: number) => void;
  /** The project's template, for highlight colors. */
  preset: SubtitleStylePreset;
  placement: CaptionPlacement;
}

const CaptionsEditorContext = createContext<CaptionsEditorValue | null>(null);

export function CaptionsEditorProvider({
  chunks,
  onChunksChange,
  onSeek,
  preset,
  placement,
  children,
}: CaptionsEditorValue & { children: ReactNode }) {
  // The editor re-renders as playback moves; a new object each time would
  // re-render every caption line with it.
  const value = useMemo(
    () => ({ chunks, onChunksChange, onSeek, preset, placement }),
    [chunks, onChunksChange, onSeek, preset, placement],
  );
  return (
    <CaptionsEditorContext.Provider value={value}>{children}</CaptionsEditorContext.Provider>
  );
}

export function useCaptionsEditor() {
  const context = useContext(CaptionsEditorContext);
  if (!context) {
    throw new Error("useCaptionsEditor must be used within a CaptionsEditorProvider");
  }
  return context;
}
