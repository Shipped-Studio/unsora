import { useState } from "react";
import type { Timeline } from "@/components/subtitle-editor/caption-style";
import { readSettings } from "@/components/subtitle-editor/editor/read-settings";
import { getCompositionDimensions } from "@/components/subtitle-editor/tabs/preview-style-tab";
import type { CaptionScene } from "@/hooks/subtitle/use-subtitle-api";
import type { TranscriptionData } from "@/remotion/types";

export type FrameOrientation = "square" | "landscape" | "portrait";

/**
 * The project's style settings: template, caption placement, overlays,
 * preview style, AI scenes and the B-roll timeline.
 *
 * Read from the project once, on mount. After that this hook owns them;
 * they're written back to the project only on Save (or with an export).
 */
export function useEditorSettings(project: TranscriptionData) {
  const [initial] = useState(() => readSettings(project));
  const [preset, setPreset] = useState(initial.preset);
  const [placement, setPlacement] = useState(initial.placement);
  const [titleOverlay, setTitleOverlay] = useState(initial.titleOverlay);
  const [watermarkOverlay, setWatermarkOverlay] = useState(initial.watermarkOverlay);
  const [previewStyle, setPreviewStyle] = useState(initial.previewStyle);
  const [scenes, setScenes] = useState<CaptionScene[]>(initial.scenes);
  const [timeline, setTimeline] = useState<Timeline>(initial.timeline);

  /** The exported video's size; the preview style can crop the source. */
  const frame = getCompositionDimensions(
    previewStyle,
    project.width ?? 1080,
    project.height ?? 1920,
  );
  const orientation: FrameOrientation =
    frame.width === frame.height ? "square" : frame.width > frame.height ? "landscape" : "portrait";

  /** The settings as saved to the project's `editorSettings`. */
  const toSaved = () => ({
    selectedPresetId: preset.id,
    preset,
    placement,
    titleOverlay,
    watermarkOverlay,
    previewStyle,
    scenes,
    timeline,
  });

  return {
    preset,
    setPreset,
    placement,
    setPlacement,
    titleOverlay,
    setTitleOverlay,
    watermarkOverlay,
    setWatermarkOverlay,
    previewStyle,
    setPreviewStyle,
    scenes,
    setScenes,
    timeline,
    setTimeline,
    frame,
    orientation,
    toSaved,
  };
}

export type EditorSettings = ReturnType<typeof useEditorSettings>;
