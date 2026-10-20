import type { TitleOverlayConfig } from "./title-overlay";

export type {
  CaptionLayout,
  KeywordLevel,
  SubtitleChunk,
  SubtitleStylePreset,
  WordEffect,
  WordTimestamp,
  ZoomStyle,
} from "./caption-style";
import type { ZoomEvent } from "./caption-animations";
import type {
  BrollLayout,
  CaptionPlacement,
  Timeline,
  SubtitleChunk,
  SubtitleStylePreset,
  ZoomStyle,
} from "./caption-style";

export type { TitleOverlayConfig };

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
  /** Moves the video at key moments. */
  zoom?: ZoomStyle;
  /** Default layout for B-roll clips. */
  brollLayout?: BrollLayout;
  /** A zoom per scene, from AI Auto Zooms; wins over `zoom`. */
  zooms?: ZoomEvent[];
}

export interface EditorSettings {
  fileName?: string;
  selectedPresetId?: string;
  preset?: SubtitleStylePreset;
  placement?: CaptionPlacement;
  timeline?: Timeline;
  titleOverlay?: TitleOverlayConfig;
  watermarkOverlay?: WatermarkOverlayConfig;
  previewStyle?: PreviewStyleConfig;
}

export interface CompositionProps {
  videoUrl: string;
  subtitleChunks: SubtitleChunk[];
  settings: EditorSettings;
}
