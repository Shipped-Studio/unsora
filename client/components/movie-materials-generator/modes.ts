import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import {
  UserCircle,
  UserRectangle,
  ListBullets,
  MapPin,
  FilmStrip,
  Palette,
  GridFour,
  Rows,
  ImageSquare,
} from "@phosphor-icons/react";
import type { ParamConfig } from "@/components/generator/param-control";
import type { UploadField } from "@/components/generator/attachments";

export type ModeKey =
  | "face"
  | "wide-body"
  | "sheet"
  | "location"
  | "first-frame"
  | "style-collage"
  | "multishot-2x4"
  | "multishot-1x4";

export interface ModeConfig {
  label: string;
  icon: ComponentType<IconProps>;
  description: string;
  placeholder: string;
  media: UploadField[];
  params: ParamConfig[];
  defaultRatio: string;
}

const cinematographyParam: ParamConfig = {
  key: "cinematography",
  label: "Look",
  type: "select",
  defaultValue: "auto",
  options: [
    { value: "auto", label: "Auto" },
    { value: "cinematic", label: "Film" },
    { value: "anime", label: "Anime" },
    { value: "realistic", label: "Realistic" },
    { value: "cartoon", label: "Cartoon" },
    { value: "fantasy", label: "Fantasy" },
  ],
};

export const aspectRatioParam: Omit<ParamConfig, "defaultValue"> = {
  key: "aspect-ratio",
  label: "Aspect ratio",
  type: "aspect",
  options: [
    { value: "auto", label: "Auto" },
    { value: "1:1", label: "1:1" },
    { value: "9:16", label: "9:16" },
    { value: "16:9", label: "16:9" },
    { value: "4:3", label: "4:3" },
    { value: "3:4", label: "3:4" },
  ],
};

export const resolutionParam: ParamConfig = {
  key: "resolution",
  label: "Resolution",
  type: "select",
  defaultValue: "2k",
  options: [
    { value: "1k", label: "1K" },
    { value: "2k", label: "2K" },
    { value: "4k", label: "4K" },
  ],
};

/**
 * Movie materials are GPT Image 2, priced by resolution. Keep in sync with
 * server/src/config/models/gpt-image-2.ts.
 */
export const RESOLUTION_CREDITS: Record<string, number> = {
  "1k": 3,
  "2k": 4,
  "4k": 6,
};

function imageField(key: string, label: string, max = 1): UploadField {
  return { key, label, accept: "image/*", max, icon: ImageSquare };
}

export const MODES: Record<ModeKey, ModeConfig> = {
  face: {
    label: "Character face",
    icon: UserCircle,
    description: "Face with age, gender and look",
    placeholder: "Describe the character's face",
    defaultRatio: "3:4",
    media: [
      imageField("face-inspiration", "Face reference"),
      imageField("style-collage", "Style collage"),
    ],
    params: [
      {
        key: "age",
        label: "Age",
        type: "select",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "child", label: "Child" },
          { value: "teen", label: "Teen" },
          { value: "adult", label: "Adult" },
          { value: "elderly", label: "Elderly" },
        ],
      },
      {
        key: "gender",
        label: "Gender",
        type: "select",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
          { value: "neutral", label: "Neutral" },
        ],
      },
      cinematographyParam,
    ],
  },
  "wide-body": {
    label: "Character full body",
    icon: UserRectangle,
    description: "Full body with outfit and pose",
    placeholder: "Describe the body, outfit and pose",
    defaultRatio: "3:4",
    media: [
      imageField("face-ref", "Face"),
      imageField("outfit-inspiration", "Outfit or body"),
      imageField("style-collage", "Style collage"),
    ],
    params: [cinematographyParam],
  },
  sheet: {
    label: "Character sheet",
    icon: ListBullets,
    description: "Turnaround from several angles",
    placeholder: "Describe the character",
    defaultRatio: "16:9",
    media: [
      imageField("face-ref", "Face"),
      imageField("wide-body-ref", "Full body"),
    ],
    params: [cinematographyParam],
  },
  location: {
    label: "Location",
    icon: MapPin,
    description: "A scene or environment",
    placeholder: "Describe the location and mood",
    defaultRatio: "16:9",
    media: [
      imageField("location-inspiration", "Location"),
      imageField("style-collage", "Style collage"),
    ],
    params: [cinematographyParam],
  },
  "first-frame": {
    label: "Video first frame",
    icon: FilmStrip,
    description: "The opening frame of a shot",
    placeholder: "Describe the first frame",
    defaultRatio: "16:9",
    media: [
      imageField("character-refs", "Characters"),
      imageField("location-ref", "Location"),
      imageField("style-collage", "Style collage"),
    ],
    params: [
      cinematographyParam,
      {
        key: "camera-angle",
        label: "Camera angle",
        type: "select",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "eye-level", label: "Eye level" },
          { value: "low-angle", label: "Low angle" },
          { value: "high-angle", label: "High angle" },
          { value: "dutch-angle", label: "Dutch angle" },
          { value: "birds-eye", label: "Bird's eye" },
          { value: "worms-eye", label: "Worm's eye" },
          { value: "over-shoulder", label: "Over the shoulder" },
        ],
      },
    ],
  },
  "style-collage": {
    label: "Style collage",
    icon: Palette,
    description: "Mood board for a visual style",
    placeholder: "Describe the style and mood",
    defaultRatio: "16:9",
    media: [imageField("inspiration-images", "Inspiration", 3)],
    params: [
      cinematographyParam,
      {
        key: "color-palette",
        label: "Palette",
        type: "select",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "warm", label: "Warm" },
          { value: "cool", label: "Cool" },
          { value: "muted", label: "Muted" },
          { value: "vibrant", label: "Vibrant" },
          { value: "monochrome", label: "Monochrome" },
          { value: "pastel", label: "Pastel" },
          { value: "neon", label: "Neon" },
        ],
      },
      {
        key: "lighting-mood",
        label: "Lighting",
        type: "select",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "natural", label: "Natural" },
          { value: "golden-hour", label: "Golden hour" },
          { value: "blue-hour", label: "Blue hour" },
          { value: "neon-lit", label: "Neon" },
          { value: "studio", label: "Studio" },
          { value: "dramatic", label: "Dramatic" },
          { value: "low-key", label: "Low key" },
          { value: "high-key", label: "High key" },
        ],
      },
      {
        key: "era-vibe",
        label: "Era",
        type: "select",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "modern", label: "Modern" },
          { value: "retro-70s", label: "70s" },
          { value: "80s-synth", label: "80s" },
          { value: "90s-grunge", label: "90s" },
          { value: "noir", label: "Noir" },
          { value: "victorian", label: "Victorian" },
          { value: "futuristic", label: "Futuristic" },
          { value: "analog-film", label: "Analog film" },
        ],
      },
    ],
  },
  "multishot-2x4": {
    label: "Shot board, 2×4",
    icon: GridFour,
    description: "8 panels for storyboarding",
    placeholder: "Describe the scene, shot by shot",
    defaultRatio: "16:9",
    media: [
      imageField("character-refs", "Characters"),
      imageField("location-ref", "Location"),
      imageField("style-collage", "Style collage"),
    ],
    params: [cinematographyParam],
  },
  "multishot-1x4": {
    label: "Shot strip, 1×4",
    icon: Rows,
    description: "4 panels in a row",
    placeholder: "Describe the scene, shot by shot",
    defaultRatio: "16:9",
    media: [
      imageField("character-refs", "Characters"),
      imageField("location-ref", "Location"),
      imageField("style-collage", "Style collage"),
    ],
    params: [cinematographyParam],
  },
};

export const MODE_KEYS = Object.keys(MODES) as ModeKey[];

export function modeLabel(mode?: string | null): string | null {
  if (!mode) return null;
  return MODES[mode as ModeKey]?.label ?? mode;
}

/** Label for a stored mode param value, e.g. "golden-hour" → "Golden hour". */
export function paramDetails(
  mode: string | null | undefined,
  params: Record<string, unknown> | null | undefined,
): { label: string; value: string }[] {
  const config = mode ? MODES[mode as ModeKey] : undefined;
  if (!config || !params) return [];
  return config.params.flatMap((param) => {
    const raw = params[param.key];
    if (typeof raw !== "string" || !raw || raw === "auto") return [];
    const label = param.options.find((o) => o.value === raw)?.label ?? raw;
    return [{ label: param.label, value: label }];
  });
}
