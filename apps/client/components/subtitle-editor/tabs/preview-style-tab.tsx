"use client";

import type { Icon } from "@phosphor-icons/react";
import {
  ArrowsIn,
  ArrowsOut,
  DropHalf,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChoiceGroup,
  ChoiceItem,
} from "@/components/subtitle-editor/editor-fields";
import type {
  BrollLayout,
  ZoomStyle,
} from "@/components/subtitle-editor/caption-style";
import type { ZoomEvent } from "@/components/subtitle-editor/caption-animations";

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

const VIDEO_FITS: { id: VideoFitId; label: string; icon: Icon }[] = [
  { id: "contain", label: "Fit", icon: ArrowsIn },
  { id: "cover", label: "Fill", icon: ArrowsOut },
  { id: "blur", label: "Blur", icon: DropHalf },
];

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

interface PreviewStyleControlsProps {
  config: PreviewStyleConfig;
  onChange: (config: PreviewStyleConfig) => void;
}

const ASPECT_ITEMS = ASPECT_RATIOS.map((option) => ({
  value: option.id,
  label: option.label,
}));

/** Frame controls that sit under the preview: aspect ratio, fill, background. */
export function PreviewStyleControls({
  config,
  onChange,
}: PreviewStyleControlsProps) {
  const update = <K extends keyof PreviewStyleConfig>(
    key: K,
    value: PreviewStyleConfig[K],
  ) => onChange({ ...config, [key]: value });

  return (
    <div className="flex items-center justify-center gap-1">
      <Select
        items={ASPECT_ITEMS}
        value={config.aspectRatio}
        onValueChange={(next) => {
          if (typeof next === "string") update("aspectRatio", next as AspectRatioId);
        }}
      >
        <SelectTrigger variant="ghost" size="sm" aria-label="Aspect ratio">
          <SelectValue />
        </SelectTrigger>
        {/* Wider than its trigger and above it, so the hints aren't cut off. */}
        <SelectContent side="top" alignItemWithTrigger={false} className="w-60">
          {ASPECT_RATIOS.map((option) => (
            <SelectItem key={option.id} value={option.id} className="pr-8">
              <span
                aria-hidden
                className="flex size-5 items-center justify-center"
              >
                <span
                  className="rounded-[2px] border-[1.5px] border-current"
                  style={{ width: option.box.w * 0.6, height: option.box.h * 0.6 }}
                />
              </span>
              {option.label}
              <span className="ml-auto text-xs text-muted-foreground">
                {option.hint}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Video fill" />
          }
        >
          <SlidersHorizontal />
        </PopoverTrigger>
        <PopoverContent side="top" sideOffset={8} className="w-80">
          <PopoverHeader>
            <PopoverTitle>Fill</PopoverTitle>
            <PopoverDescription>
              How the video fills a frame of a different shape.
            </PopoverDescription>
          </PopoverHeader>
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
                className="flex-col gap-1 px-2 py-2.5 text-center whitespace-normal"
              >
                <option.icon />
                <span className="text-xs font-medium">{option.label}</span>
              </ChoiceItem>
            ))}
          </ChoiceGroup>

        </PopoverContent>
      </Popover>
    </div>
  );
}
