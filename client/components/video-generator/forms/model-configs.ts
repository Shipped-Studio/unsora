import { ImageSquare, VideoCamera, MusicNote } from "@phosphor-icons/react";
import { getDurationOptions } from "@/lib/utils";
import { type VideoGenerationSubmitParams } from "@/hooks/use-video-generation";
import {
  parseDuration,
  type ParamConfig,
  type ParamOption,
} from "@/components/generator/param-control";
import type { UploadField } from "@/components/generator/attachments";

export type ModelKey =
  | "seedance"
  | "seedance-fast"
  | "seedance-mini"
  | "kling-standard"
  | "kling-pro"
  | "veo"
  | "veo-fast"
  | "veo-lite"
  | "gemini-omni-flash"
  | "sora-2"
  | "sora-2-pro";

export interface UploadFieldConfig extends UploadField {
  /** Only visible when the given param currently equals one of these values. */
  when?: { param: string; equals: string[] };
}

export interface BuildSubmitArgs {
  model: ModelKey;
  prompt: string;
  negativePrompt: string;
  count: number;
  params: Record<string, string>;
  /** Upload field key → storage blob URLs (visible fields only). */
  uploads: Record<string, string[]>;
}

export interface ModelConfig {
  key: ModelKey;
  label: string;
  provider: string;
  /** Provider logo path under /public. */
  icon: string;
  description: string;
  priceHint: string;
  placeholder: string;
  supportsNegativePrompt: boolean;
  /** Enables the @-mention prompt editor referencing uploaded files. */
  fileMentions?: boolean;
  params: ParamConfig[];
  uploadFields: UploadFieldConfig[];
  calculateCredits(
    params: Record<string, string>,
    fileCounts: Record<string, number>,
  ): number;
  buildSubmitParams(args: BuildSubmitArgs): VideoGenerationSubmitParams;
}

function tierCredits(
  tiers: [maxDuration: number, credits: number][],
  duration: number,
): number {
  for (const [maxDur, cost] of tiers) {
    if (duration <= maxDur) return cost;
  }
  return tiers[tiers.length - 1][1];
}

export function getVisibleUploadFields(
  config: ModelConfig,
  params: Record<string, string>,
): UploadFieldConfig[] {
  return config.uploadFields.filter(
    (f) => !f.when || f.when.equals.includes(params[f.when.param] ?? ""),
  );
}

export function getDefaultParams(config: ModelConfig): Record<string, string> {
  return Object.fromEntries(
    config.params.map((p) => [p.key, p.defaultValue]),
  );
}

const STANDARD_ASPECTS: ParamOption[] = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
];

const VEO_ASPECTS: ParamOption[] = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
];

// Veo 3.1 supports discrete 4s / 6s / 8s clips (720p & 1080p, 24 FPS).
const VEO_DURATIONS: ParamOption[] = [
  { value: "4", label: "4s" },
  { value: "6", label: "6s" },
  { value: "8", label: "8s" },
];

const SORA_DURATIONS: ParamOption[] = [
  { value: "4", label: "4s" },
  { value: "8", label: "8s" },
  { value: "12", label: "12s" },
  { value: "16", label: "16s" },
  { value: "20", label: "20s" },
];

const SOUND_PARAM: ParamConfig = {
  key: "sound",
  label: "Audio",
  type: "toggle",
  options: [
    { value: "enabled", label: "On" },
    { value: "disabled", label: "Off" },
  ],
  defaultValue: "enabled",
};

// Seedance

const SEEDANCE_MODE: ParamConfig = {
  key: "mode",
  label: "Mode",
  type: "select",
  options: [
    { value: "omni", label: "Omni reference" },
    { value: "first-last", label: "First and last frame" },
  ],
  defaultValue: "omni",
};

const SEEDANCE_UPLOADS: UploadFieldConfig[] = [
  {
    key: "image",
    label: "Image",
    accept: "image/*",
    max: 9,
    icon: ImageSquare,
    when: { param: "mode", equals: ["omni"] },
  },
  {
    key: "video",
    label: "Video",
    accept: "video/*",
    max: 3,
    icon: VideoCamera,
    when: { param: "mode", equals: ["omni"] },
  },
  {
    key: "audio",
    label: "Audio",
    accept: "audio/*",
    max: 3,
    icon: MusicNote,
    when: { param: "mode", equals: ["omni"] },
  },
  {
    key: "first_frame",
    label: "First frame",
    accept: "image/*",
    max: 1,
    icon: ImageSquare,
    when: { param: "mode", equals: ["first-last"] },
  },
  {
    key: "last_frame",
    label: "Last frame",
    accept: "image/*",
    max: 1,
    icon: ImageSquare,
    when: { param: "mode", equals: ["first-last"] },
  },
];

function buildSeedanceParams(
  resolution: string,
  { model, prompt, count, params, uploads }: BuildSubmitArgs,
): VideoGenerationSubmitParams {
  const mode = params.mode ?? "omni";
  const result: VideoGenerationSubmitParams = {
    model,
    prompt,
    duration: parseDuration(params.duration ?? "10"),
    aspectRatio: params["aspect-ratio"] ?? "16:9",
    count,
    mode,
    resolution,
    generateAudio: (params.sound ?? "enabled") === "enabled",
  };

  if (mode === "omni") {
    result.imageFiles = uploads.image;
    result.videoFiles = uploads.video;
    result.audioFiles = uploads.audio;
  } else {
    if (uploads.first_frame?.[0]) result.startFrame = uploads.first_frame[0];
    if (uploads.last_frame?.[0]) result.endFrame = uploads.last_frame[0];
  }

  return result;
}

function seedanceConfig(
  key: ModelKey,
  label: string,
  description: string,
  priceHint: string,
  resolution: string,
  tiersWithVideo: [number, number][],
  tiersDefault: [number, number][],
): ModelConfig {
  return {
    key,
    label,
    provider: "ByteDance",
    icon: "/models/bytedance.svg",
    description,
    priceHint,
    placeholder: "Describe the video. Type @ to reference attached files",
    supportsNegativePrompt: false,
    fileMentions: true,
    params: [
      SEEDANCE_MODE,
      {
        key: "duration",
        label: "Duration",
        type: "duration",
        options: getDurationOptions(5, 15),
        defaultValue: "10",
      },
      {
        key: "aspect-ratio",
        label: "Aspect ratio",
        type: "aspect",
        options: STANDARD_ASPECTS,
        defaultValue: "16:9",
      },
      SOUND_PARAM,
    ],
    uploadFields: SEEDANCE_UPLOADS,
    calculateCredits: (params, fileCounts) => {
      const duration = parseDuration(params.duration ?? "10");
      const hasVideo = (fileCounts.video ?? 0) > 0;
      return tierCredits(hasVideo ? tiersWithVideo : tiersDefault, duration);
    },
    buildSubmitParams: (args) => buildSeedanceParams(resolution, args),
  };
}

// Kling

const KLING_UPLOADS: UploadFieldConfig[] = [
  { key: "image", label: "Image", accept: "image/*", max: 1, icon: ImageSquare },
  {
    key: "end_image",
    label: "End image",
    accept: "image/*",
    max: 1,
    icon: ImageSquare,
  },
];

function klingConfig(
  key: ModelKey,
  label: string,
  description: string,
  priceHint: string,
  tiersWithSound: [number, number][],
  tiersNoSound: [number, number][],
): ModelConfig {
  return {
    key,
    label,
    provider: "Kling",
    icon: "/models/kling.svg",
    description,
    priceHint,
    placeholder: "Describe the video",
    supportsNegativePrompt: true,
    params: [
      {
        key: "duration",
        label: "Duration",
        type: "duration",
        options: getDurationOptions(5, 10),
        defaultValue: "10",
      },
      {
        key: "aspect-ratio",
        label: "Aspect ratio",
        type: "aspect",
        options: STANDARD_ASPECTS,
        defaultValue: "16:9",
      },
      SOUND_PARAM,
    ],
    uploadFields: KLING_UPLOADS,
    calculateCredits: (params) => {
      const duration = parseDuration(params.duration ?? "10");
      const sound = (params.sound ?? "enabled") === "enabled";
      return tierCredits(sound ? tiersWithSound : tiersNoSound, duration);
    },
    buildSubmitParams: ({ model, prompt, negativePrompt, count, params, uploads }) => {
      const result: VideoGenerationSubmitParams = {
        model,
        prompt,
        duration: parseDuration(params.duration ?? "10"),
        aspectRatio: params["aspect-ratio"] ?? "16:9",
        count,
        sound: (params.sound ?? "enabled") === "enabled",
      };
      if (negativePrompt) result.negativePrompt = negativePrompt;
      if (uploads.image?.[0]) result.image = uploads.image[0];
      if (uploads.end_image?.[0]) result.endImage = uploads.end_image[0];
      return result;
    },
  };
}

// Veo

// Veo credits come from the repriced credit schedule, keyed by duration and
// whether audio is on. Keep in sync with the server's credits() in
// server/src/config/models/veo-3.1*.ts.

const VEO_FRAME_UPLOADS: UploadFieldConfig[] = [
  {
    key: "first_frame",
    label: "First frame",
    accept: "image/*",
    max: 1,
    icon: ImageSquare,
    when: { param: "mode", equals: ["FIRST_AND_LAST_FRAMES_2_VIDEO"] },
  },
  {
    key: "last_frame",
    label: "Last frame",
    accept: "image/*",
    max: 1,
    icon: ImageSquare,
    when: { param: "mode", equals: ["FIRST_AND_LAST_FRAMES_2_VIDEO"] },
  },
];

const VEO_REFERENCE_UPLOAD: UploadFieldConfig = {
  key: "imageUrls",
  label: "Reference",
  accept: "image/*",
  max: 3,
  icon: ImageSquare,
  when: { param: "mode", equals: ["REFERENCE_2_VIDEO"] },
};

function buildVeoParams({
  model,
  prompt,
  count,
  params,
  uploads,
}: BuildSubmitArgs): VideoGenerationSubmitParams {
  const mode = params.mode ?? "TEXT_2_VIDEO";
  const result: VideoGenerationSubmitParams = {
    model,
    prompt,
    count,
    duration: parseDuration(params.duration ?? "8"),
    mode,
    aspectRatio: params["aspect-ratio"] ?? "16:9",
    sound: (params.sound ?? "enabled") === "enabled",
  };

  if (mode === "FIRST_AND_LAST_FRAMES_2_VIDEO") {
    const urls: string[] = [];
    if (uploads.first_frame?.[0]) urls.push(uploads.first_frame[0]);
    if (uploads.last_frame?.[0]) urls.push(uploads.last_frame[0]);
    if (urls.length) result.imageUrls = urls;
  } else if (mode === "REFERENCE_2_VIDEO") {
    if (uploads.imageUrls?.length) result.imageUrls = uploads.imageUrls;
  }

  return result;
}

function veoConfig(
  key: ModelKey,
  label: string,
  description: string,
  priceHint: string,
  tiersWithSound: [number, number][],
  tiersNoSound: [number, number][],
  withReferenceMode: boolean,
): ModelConfig {
  const modeOptions: ParamOption[] = [
    { value: "TEXT_2_VIDEO", label: "Text to video" },
    { value: "FIRST_AND_LAST_FRAMES_2_VIDEO", label: "First and last frame" },
    ...(withReferenceMode
      ? [{ value: "REFERENCE_2_VIDEO", label: "Reference to video" }]
      : []),
  ];

  return {
    key,
    label,
    provider: "Google",
    icon: "/models/google.svg",
    description,
    priceHint,
    placeholder: "Describe the video",
    supportsNegativePrompt: false,
    params: [
      {
        key: "mode",
        label: "Mode",
        type: "select",
        options: modeOptions,
        defaultValue: "TEXT_2_VIDEO",
      },
      {
        key: "duration",
        label: "Duration",
        type: "duration",
        options: VEO_DURATIONS,
        defaultValue: "8",
      },
      {
        key: "aspect-ratio",
        label: "Aspect ratio",
        type: "aspect",
        options: VEO_ASPECTS,
        defaultValue: "16:9",
        hideLabel: true,
      },
      SOUND_PARAM,
    ],
    uploadFields: [
      ...VEO_FRAME_UPLOADS,
      ...(withReferenceMode ? [VEO_REFERENCE_UPLOAD] : []),
    ],
    calculateCredits: (params) => {
      const sound = (params.sound ?? "enabled") === "enabled";
      return tierCredits(
        sound ? tiersWithSound : tiersNoSound,
        parseDuration(params.duration ?? "8"),
      );
    },
    buildSubmitParams: buildVeoParams,
  };
}

// Sora

function soraConfig(
  key: ModelKey,
  label: string,
  description: string,
  priceHint: string,
  aspects: ParamOption[],
  tiers: [number, number][],
): ModelConfig {
  return {
    key,
    label,
    provider: "OpenAI",
    icon: "/models/openai.svg",
    description,
    priceHint,
    placeholder: "Describe the video",
    supportsNegativePrompt: false,
    params: [
      {
        key: "duration",
        label: "Duration",
        type: "duration",
        options: SORA_DURATIONS,
        defaultValue: "4",
      },
      {
        key: "aspect-ratio",
        label: "Aspect ratio",
        type: "aspect",
        options: aspects,
        defaultValue: "16:9",
      },
    ],
    uploadFields: [
      {
        key: "image",
        label: "Image",
        accept: "image/*",
        max: 1,
        icon: ImageSquare,
      },
    ],
    calculateCredits: (params) =>
      tierCredits(tiers, parseDuration(params.duration ?? "4")),
    buildSubmitParams: ({ model, prompt, count, params, uploads }) => {
      const result: VideoGenerationSubmitParams = {
        model,
        prompt,
        duration: parseDuration(params.duration ?? "4"),
        aspectRatio: params["aspect-ratio"] ?? "16:9",
        count,
      };
      if (uploads.image?.[0]) result.image = uploads.image[0];
      return result;
    },
  };
}

export const MODEL_CONFIGS: Record<ModelKey, ModelConfig> = {
  seedance: seedanceConfig(
    "seedance",
    "Seedance 2.0",
    "Motion-heavy video with image, video and audio references",
    "from 64 credits",
    "720p",
    [[5, 64], [10, 127], [15, 190]],
    [[5, 64], [10, 127], [15, 190]],
  ),
  "seedance-fast": seedanceConfig(
    "seedance-fast",
    "Seedance 2.0 Fast",
    "Faster Seedance with lower latency",
    "from 37 credits",
    "720p",
    [[5, 37], [10, 74], [15, 111]],
    [[5, 37], [10, 74], [15, 111]],
  ),
  "seedance-mini": seedanceConfig(
    "seedance-mini",
    "Seedance 2.0 Mini",
    "Lowest-cost Seedance for high volume",
    "from 32 credits",
    "720p",
    [[5, 32], [10, 64], [15, 95]],
    [[5, 32], [10, 64], [15, 95]],
  ),
  "kling-standard": klingConfig(
    "kling-standard",
    "Kling 3.0 Standard",
    "General-purpose video with wide aspect ratio support",
    "from 74 credits",
    [[5, 74], [10, 148], [15, 222]],
    [[5, 74], [10, 148], [15, 222]],
  ),
  "kling-pro": klingConfig(
    "kling-pro",
    "Kling 3.0 Pro",
    "Higher quality Kling output",
    "from 74 credits",
    [[5, 74], [10, 148], [15, 222]],
    [[5, 74], [10, 148], [15, 222]],
  ),
  veo: veoConfig(
    "veo",
    "Veo 3.1",
    "Google's highest fidelity video model",
    "from 43 credits",
    [[4, 85], [6, 127], [8, 169]],
    [[4, 43], [6, 64], [8, 85]],
    true,
  ),
  "veo-fast": veoConfig(
    "veo-fast",
    "Veo 3.1 Fast",
    "Lower-cost Veo 3.1",
    "from 22 credits",
    [[4, 33], [6, 49], [8, 65]],
    [[4, 22], [6, 33], [8, 43]],
    true,
  ),
  "veo-lite": veoConfig(
    "veo-lite",
    "Veo 3.1 Lite",
    "Veo 3.1 for high volume",
    "from 64 credits",
    [[4, 64], [6, 95], [8, 127]],
    [[4, 64], [6, 95], [8, 127]],
    false,
  ),
  "gemini-omni-flash": {
    key: "gemini-omni-flash",
    label: "Gemini Omni Flash",
    provider: "Google",
    icon: "/models/google.svg",
    description: "Fast short-form video with native synchronized audio",
    priceHint: "from 37 credits",
    placeholder: "Describe the scene, motion and sound",
    supportsNegativePrompt: false,
    params: [
      {
        key: "duration",
        label: "Duration",
        type: "duration",
        options: getDurationOptions(3, 10),
        defaultValue: "8",
      },
      {
        key: "aspect-ratio",
        label: "Aspect ratio",
        type: "aspect",
        options: VEO_ASPECTS,
        defaultValue: "16:9",
      },
    ],
    uploadFields: [
      {
        key: "image",
        label: "Images",
        accept: "image/*",
        max: 4,
        icon: ImageSquare,
      },
    ],
    // One image → image-to-video; multiple → reference-to-video, which bills
    // higher. Keep in sync with server/src/config/models/gemini-omni-flash.ts.
    calculateCredits: (params, fileCounts) => {
      const reference = (fileCounts.image ?? 0) > 1;
      return tierCredits(
        reference ? [[5, 43], [10, 85]] : [[5, 37], [10, 74]],
        parseDuration(params.duration ?? "8"),
      );
    },
    buildSubmitParams: ({ model, prompt, count, params, uploads }) => {
      const result: VideoGenerationSubmitParams = {
        model,
        prompt,
        duration: parseDuration(params.duration ?? "8"),
        aspectRatio: params["aspect-ratio"] ?? "16:9",
        count,
      };
      const images = uploads.image ?? [];
      if (images.length > 1) {
        result.referenceImages = images.slice(0, 4);
      } else if (images[0]) {
        result.image = images[0];
      }
      return result;
    },
  },
  "sora-2": soraConfig(
    "sora-2",
    "Sora 2",
    "OpenAI video model",
    "from 22 credits",
    [
      { value: "16:9", label: "16:9" },
      { value: "9:16", label: "9:16" },
    ],
    [[4, 22], [8, 43], [12, 64], [16, 85], [20, 106]],
  ),
  "sora-2-pro": soraConfig(
    "sora-2-pro",
    "Sora 2 Pro",
    "Higher fidelity Sora",
    "from 64 credits",
    [
      { value: "16:9", label: "16:9" },
      { value: "9:16", label: "9:16" },
      { value: "7:4", label: "7:4" },
      { value: "4:7", label: "4:7" },
    ],
    [[4, 64], [8, 127], [12, 190], [16, 253], [20, 316]],
  ),
};

export const MODEL_KEYS = Object.keys(MODEL_CONFIGS) as ModelKey[];

/** Stored model names (history rows) mapped to display labels. */
const STORED_MODEL_LABELS: Record<string, string> = {
  "seedance_2.0": "Seedance 2.0",
  seedance_2_0: "Seedance 2.0",
  "seedance_2.0_fast": "Seedance 2.0 Fast",
  seedance_2_0_fast: "Seedance 2.0 Fast",
  "seedance_2.0_mini": "Seedance 2.0 Mini",
  kling_v3_std: "Kling 3.0 Standard",
  kling_v3_pro: "Kling 3.0 Pro",
  veo3_1: "Veo 3.1",
  veo3_1_fast: "Veo 3.1 Fast",
  veo3_1_lite: "Veo 3.1 Lite",
  "veo_3.1": "Veo 3.1",
  gemini_omni_flash: "Gemini Omni Flash",
  sora_2: "Sora 2",
  sora_2_pro: "Sora 2 Pro",
  "wan_2.6": "Wan 2.6",
  wan: "Wan 2.6",
};

export function videoModelLabel(model: string): string {
  return (
    MODEL_CONFIGS[model as ModelKey]?.label ??
    STORED_MODEL_LABELS[model] ??
    model
  );
}
