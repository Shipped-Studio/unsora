"use client";

import type { Icon } from "@phosphor-icons/react";
import { ArrowsIn, ArrowsOut, DropHalf } from "@phosphor-icons/react";
import {
  ChoiceGroup,
  ChoiceItem,
  ColorField,
  EditorSection,
} from "@/components/subtitle-editor/editor-fields";

export type AspectRatioId = "original" | "9:16" | "1:1" | "4:5" | "16:9";
export type VideoFitId = "contain" | "cover" | "blur";

export interface PreviewStyleConfig {
  aspectRatio: AspectRatioId;
  videoFit: VideoFitId;
  backgroundColor: string;
}

export const PREVIEW_STYLE_DEFAULTS: PreviewStyleConfig = {
  aspectRatio: "original",
  videoFit: "contain",
  backgroundColor: "#000000",
};

const ASPECT_RATIOS: {
  id: AspectRatioId;
  label: string;
  hint: string;
  /** Outline drawn in the tile, in px. */
  box: { w: number; h: number };
}[] = [
  { id: "original", label: "Original", hint: "Same as video", box: { w: 20, h: 20 } },
  { id: "9:16", label: "9:16", hint: "Reels, TikTok", box: { w: 13, h: 23 } },
  { id: "1:1", label: "1:1", hint: "Square", box: { w: 20, h: 20 } },
  { id: "4:5", label: "4:5", hint: "Feed", box: { w: 18, h: 23 } },
  { id: "16:9", label: "16:9", hint: "YouTube", box: { w: 26, h: 15 } },
];

const VIDEO_FITS: { id: VideoFitId; label: string; hint: string; icon: Icon }[] =
  [
    { id: "contain", label: "Fit", hint: "Show the whole video", icon: ArrowsIn },
    { id: "cover", label: "Fill", hint: "Crop to the frame", icon: ArrowsOut },
    { id: "blur", label: "Blur", hint: "Blurred backdrop", icon: DropHalf },
  ];

const BACKGROUND_COLORS = [
  "#000000",
  "#ffffff",
  "#18181b",
  "#1e3a5f",
  "#166534",
  "#7c2d12",
  "#4c1d95",
  "#831843",
] as const;

/**
 * Canvas size for an aspect ratio. Fixed ratios use 1080 on the short side;
 * "original" follows the source video. Rounded to even numbers for h264.
 */
export function getCompositionDimensions(
  config: PreviewStyleConfig | null | undefined,
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } {
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  switch (config?.aspectRatio) {
    case "9:16":
      return { width: 1080, height: 1920 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "4:5":
      return { width: 1080, height: 1350 };
    case "16:9":
      return { width: 1920, height: 1080 };
    default:
      return { width: even(sourceWidth), height: even(sourceHeight) };
  }
}

interface PreviewStyleTabProps {
  config: PreviewStyleConfig;
  onChange: (config: PreviewStyleConfig) => void;
}

export function PreviewStyleTab({ config, onChange }: PreviewStyleTabProps) {
  const update = <K extends keyof PreviewStyleConfig>(
    key: K,
    value: PreviewStyleConfig[K],
  ) => onChange({ ...config, [key]: value });

  return (
    <div className="space-y-8">
      <EditorSection
        title="Aspect ratio"
        description="Sets the frame of the preview and the export."
      >
        <ChoiceGroup
          label="Aspect ratio"
          value={config.aspectRatio}
          onChange={(value) => update("aspectRatio", value)}
          className="grid grid-cols-3 sm:grid-cols-5"
        >
          {ASPECT_RATIOS.map((option) => (
            <ChoiceItem
              key={option.id}
              value={option.id}
              className="flex-col gap-1.5 px-2 py-3 text-center whitespace-normal"
            >
              <span className="flex h-6 items-center" aria-hidden>
                <span
                  className="rounded-[3px] border-2 border-current"
                  style={{ width: option.box.w, height: option.box.h }}
                />
              </span>
              <span className="text-xs font-medium">{option.label}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {option.hint}
              </span>
            </ChoiceItem>
          ))}
        </ChoiceGroup>
      </EditorSection>

      <EditorSection
        title="Fill"
        description="How the video fills a frame of a different shape."
      >
        <ChoiceGroup
          label="Video fill"
          value={config.videoFit}
          onChange={(value) => update("videoFit", value)}
          className="grid grid-cols-3"
        >
          {VIDEO_FITS.map((option) => (
            <ChoiceItem
              key={option.id}
              value={option.id}
              className="flex-col gap-1.5 px-2 py-3 text-center whitespace-normal"
            >
              <option.icon />
              <span className="text-xs font-medium">{option.label}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {option.hint}
              </span>
            </ChoiceItem>
          ))}
        </ChoiceGroup>
      </EditorSection>

      {config.videoFit === "contain" ? (
        <EditorSection title="Background">
          <ColorField
            label="Background color"
            value={config.backgroundColor}
            options={BACKGROUND_COLORS}
            onChange={(color) => update("backgroundColor", color)}
          />
        </EditorSection>
      ) : null}
    </div>
  );
}
