/** An animation a word plays the moment it's spoken. */
export type WordEffect = "pop" | "bounce" | "shake" | "zoom" | "swing" | "glow";

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  /** Start a new row on screen after this word. */
  lineBreak?: boolean;
  effect?: WordEffect;
}

export interface SubtitleChunk {
  text: string;
  start: number;
  end: number;
  words: WordTimestamp[];
  /** Kept in the transcript but not drawn on the video. */
  hidden?: boolean;
  /** Shown on its own row under the line. */
  emoji?: string;
}

export type EditorSettings = {
  fileName?: string;
  selectedPresetId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export interface TranscriptionData {
  id: string;
  title?: string;
  filename?: string;
  text: string;
  language: string;
  duration: number;
  width?: number;
  height?: number;
  videoAsset?: { id: string; url: string; name: string; mimeType: string; type: string } | null;
  status?: string;
  segments: {
    text: string;
    start: number;
    end: number;
    words: WordTimestamp[];
  }[];
  subtitleChunks: SubtitleChunk[];
  editorSettings?: Record<string, unknown>;
  maxWordsPerChunk: number;
  videoExports: VideoExportItem[];
}

export interface VideoExportItem {
  id: string;
  outputAsset?: { id: string; url: string } | null;
  sourceAsset?: { id: string; url: string } | null;
  settings: Record<string, unknown>;
  duration: number;
  fps: number;
  width?: number;
  height?: number;
  status?: string;
  error?: string | null;
  createdAt: Date | string;
}
