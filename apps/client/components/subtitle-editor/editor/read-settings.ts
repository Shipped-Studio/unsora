import {
  CAPTION_PLACEMENT_LIMITS,
  DEFAULT_CAPTION_WIDTH,
  EMPTY_TIMELINE,
  presetPlacement,
  type CaptionPlacement,
  type Timeline,
} from "@/components/subtitle-editor/caption-style";
import { TRANSCRIPTION_LANGUAGES } from "@/components/subtitle-editor/captions/languages";
import {
  SUBTITLE_PRESETS,
  type SubtitleStylePreset,
} from "@/components/subtitle-editor/style-presets";
import {
  WATERMARK_OVERLAY_DEFAULTS,
  type WatermarkOverlayConfig,
} from "@/components/subtitle-editor/tabs/edit-watermark-tab";
import {
  PREVIEW_STYLE_DEFAULTS,
  getCompositionDimensions,
  type PreviewStyleConfig,
} from "@/components/subtitle-editor/tabs/preview-style-tab";
import { normalizeTitleOverlay } from "@/components/subtitle-editor/title-overlay";
import type { CaptionScene } from "@/hooks/subtitle/use-subtitle-api";
import type { TranscriptionData } from "@/remotion/types";

/**
 * Reading a project's saved editor settings. Saves from older versions of
 * the editor are converted to today's shape here, so nothing else has to.
 */

/** The project's `editorSettings` column, as any version of the editor saved it. */
interface StoredSettings {
  selectedPresetId?: string;
  /** The selected preset with any customizations. */
  preset?: SubtitleStylePreset;
  placement?: Partial<CaptionPlacement>;
  /** Projects saved before placement: pixels, measured from the bottom. */
  sizePosition?: { fontSize?: number; xAxis?: number; yAxis?: number; width?: number };
  titleOverlay?: unknown;
  watermarkOverlay?: Partial<WatermarkOverlayConfig>;
  previewStyle?: Partial<PreviewStyleConfig>;
  /** AI scenes, from AI Auto Zooms or the B-rolls tab. */
  scenes?: CaptionScene[];
  timeline?: Partial<Timeline>;
}

/** Every setting the editor starts from, with defaults filled in. */
export function readSettings(project: TranscriptionData) {
  const stored = (project.editorSettings ?? {}) as StoredSettings;
  const previewStyle = { ...PREVIEW_STYLE_DEFAULTS, ...stored.previewStyle };
  const frame = getCompositionDimensions(
    previewStyle,
    project.width ?? 1080,
    project.height ?? 1920,
  );
  const preset = readPreset(stored);
  return {
    preset,
    placement: readPlacement(stored, preset, frame.width),
    titleOverlay: normalizeTitleOverlay(stored.titleOverlay, frame),
    watermarkOverlay: { ...WATERMARK_OVERLAY_DEFAULTS, ...stored.watermarkOverlay },
    previewStyle,
    scenes: Array.isArray(stored.scenes) ? stored.scenes : [],
    timeline: { ...EMPTY_TIMELINE, ...stored.timeline },
  };
}

/**
 * The project's language as a code for the language picker. The column holds
 * either a chosen code ("en") or the detected language's full name ("english").
 */
export function readLanguage(stored: string | null | undefined): string {
  const value = stored?.toLowerCase();
  const match = TRANSCRIPTION_LANGUAGES.find(
    (l) => l.code === value || l.label.toLowerCase() === value,
  );
  return match?.code ?? "auto";
}

export function projectDisplayTitle(project: TranscriptionData): string {
  return project.title || project.filename || "Untitled project";
}

const clampTo = (n: number, { min, max }: { min: number; max: number }) =>
  Math.min(max, Math.max(min, n));

/** The project's template; older saves get today's version of their look. */
function readPreset(stored: StoredSettings): SubtitleStylePreset {
  const builtIn = SUBTITLE_PRESETS.find((p) => p.id === stored.selectedPresetId);
  const saved =
    stored.preset && stored.preset.id === stored.selectedPresetId
      ? stored.preset
      : undefined;
  if (saved?.position) return saved;
  return builtIn ?? (saved ? { ...SUBTITLE_PRESETS[0], ...saved } : SUBTITLE_PRESETS[0]);
}

/** Where captions sit. Older saves stored pixels, converted to percentages here. */
function readPlacement(
  stored: StoredSettings,
  preset: SubtitleStylePreset,
  frameWidth: number,
): CaptionPlacement {
  if (stored.placement) {
    return { ...presetPlacement(preset), ...stored.placement };
  }
  const old = stored.sizePosition;
  if (!old) return presetPlacement(preset);
  const limits = CAPTION_PLACEMENT_LIMITS;
  return {
    size: clampTo(((old.fontSize ?? 43) * 540) / frameWidth, limits.size),
    x: clampTo(50 + (old.xAxis ?? 0), limits.x),
    // The old value was the distance of the text's bottom from the frame's.
    y: clampTo(97 - (old.yAxis ?? 20), limits.y),
    width: old.width
      ? clampTo((old.width / frameWidth) * 100, limits.width)
      : DEFAULT_CAPTION_WIDTH,
  };
}
