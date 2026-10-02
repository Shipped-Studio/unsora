export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface SubtitleChunk {
  text: string;
  start: number;
  end: number;
  words: WordTimestamp[];
}

export interface SubtitleStylePreset {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  textTransform: "none" | "uppercase";
  color: string;
  highlightColor?: string;
  highlightBgColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string;
  backgroundPadding?: number;
  shadow?: string;
}

export interface SizePositionValues {
  fontSize: number;
  width: number;
  height: number;
  xAxis: number;
  yAxis: number;
}

export interface TitleOverlayConfig {
  enabled: boolean;
  text: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  xAxis: number;
  yAxis: number;
  width: number;
}

export type WatermarkPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface WatermarkOverlayConfig {
  enabled: boolean;
  type: "text" | "image";
  text: string;
  imageUrl: string;
  fontSize: number;
  color: string;
  opacity: number;
  position: WatermarkPosition;
}

export type AspectRatioId = "original" | "9:16" | "1:1" | "4:5" | "16:9";
export type VideoFitId = "contain" | "cover" | "blur";

export interface PreviewStyleConfig {
  aspectRatio: AspectRatioId;
  videoFit: VideoFitId;
  backgroundColor: string;
}

export interface EditorSettings {
  fileName?: string;
  selectedPresetId?: string;
  preset?: SubtitleStylePreset;
  sizePosition?: SizePositionValues;
  titleOverlay?: TitleOverlayConfig;
  watermarkOverlay?: WatermarkOverlayConfig;
  previewStyle?: PreviewStyleConfig;
}

export interface CompositionProps {
  videoUrl: string;
  subtitleChunks: SubtitleChunk[];
  settings: EditorSettings;
}
