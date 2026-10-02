import type { ParamConfig } from "@/components/generator/param-control";

export type ModelKey =
  | "nano-banana-2"
  | "nano-banana-pro"
  | "seedream-v5-lite"
  | "gpt-image-1.5"
  | "gpt-image-2";

const NANO_RATIOS: ParamConfig = {
  key: "ratio",
  label: "Aspect ratio",
  type: "aspect",
  defaultValue: "1:1",
  options: [
    { value: "1:1", label: "1:1" },
    { value: "16:9", label: "16:9" },
    { value: "9:16", label: "9:16" },
    { value: "4:3", label: "4:3" },
    { value: "3:4", label: "3:4" },
  ],
};

const RESOLUTION: ParamConfig = {
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

export interface ImageModelConfig {
  key: ModelKey;
  label: string;
  provider: string;
  icon: string;
  description: string;
  priceHint: string;
  maxImages: number;
  params: ParamConfig[];
  credits(params: Record<string, string>): number;
}

export const MODEL_CONFIGS: Record<ModelKey, ImageModelConfig> = {
  "nano-banana-2": {
    key: "nano-banana-2",
    label: "Nano Banana 2",
    provider: "Google",
    icon: "/models/google.svg",
    description: "Fast, high-quality image generation and editing",
    priceHint: "from 2 credits",
    maxImages: 20,
    params: [NANO_RATIOS, RESOLUTION],
    // Keep in sync with server/src/config/models/nano-banana-2.ts.
    credits: (params) => {
      const res = params.resolution ?? "2k";
      return res === "4k" ? 6 : res === "2k" ? 3 : 2;
    },
  },
  "nano-banana-pro": {
    key: "nano-banana-pro",
    label: "Nano Banana Pro",
    provider: "Google",
    icon: "/models/google.svg",
    description: "Highest-fidelity Nano Banana with 4K output",
    priceHint: "from 5 credits",
    maxImages: 20,
    params: [NANO_RATIOS, RESOLUTION],
    // Keep in sync with server/src/config/models/nano-banana-pro.ts.
    credits: (params) => ((params.resolution ?? "2k") === "4k" ? 8 : 5),
  },
  "seedream-v5-lite": {
    key: "seedream-v5-lite",
    label: "Seedream v5 Lite",
    provider: "ByteDance",
    icon: "/models/bytedance.svg",
    description: "Versatile generation with wide aspect ratio support",
    priceHint: "2 credits",
    maxImages: 14,
    params: [
      {
        key: "ratio",
        label: "Aspect ratio",
        type: "aspect",
        defaultValue: "1:1",
        options: [
          { value: "1:1", label: "1:1" },
          { value: "4:3", label: "4:3" },
          { value: "3:4", label: "3:4" },
          { value: "16:9", label: "16:9" },
          { value: "9:16", label: "9:16" },
          { value: "2:3", label: "2:3" },
          { value: "3:2", label: "3:2" },
          { value: "21:9", label: "21:9" },
        ],
      },
      {
        key: "resolution",
        label: "Quality",
        type: "select",
        defaultValue: "basic",
        options: [
          { value: "basic", label: "Basic (2K)" },
          { value: "high", label: "High (3K)" },
        ],
      },
    ],
    // $0.035 flat regardless of quality → same price for basic and high.
    // Keep in sync with server/src/config/models/seedream-v5-lite.ts.
    credits: () => 2,
  },
  "gpt-image-1.5": {
    key: "gpt-image-1.5",
    label: "GPT Image 1.5",
    provider: "OpenAI",
    icon: "/models/openai.svg",
    description: "OpenAI image model with strong prompt following",
    priceHint: "2 credits",
    maxImages: 20,
    params: [
      {
        key: "ratio",
        label: "Aspect ratio",
        type: "aspect",
        defaultValue: "1:1",
        options: [
          { value: "1:1", label: "1:1" },
          { value: "2:3", label: "2:3" },
          { value: "3:2", label: "3:2" },
        ],
      },
      {
        key: "quality",
        label: "Quality",
        type: "select",
        defaultValue: "medium",
        options: [
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
        ],
      },
    ],
    // $0.05 flat across all sizes → same price regardless of quality.
    // Keep in sync with server/src/config/models/gpt-image-1.5.ts.
    credits: () => 2,
  },
  "gpt-image-2": {
    key: "gpt-image-2",
    label: "GPT Image 2",
    provider: "OpenAI",
    icon: "/models/openai.svg",
    description: "OpenAI image model with 4K output",
    priceHint: "from 3 credits",
    maxImages: 16,
    params: [
      {
        key: "ratio",
        label: "Aspect ratio",
        type: "aspect",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "1:1", label: "1:1" },
          { value: "16:9", label: "16:9" },
          { value: "9:16", label: "9:16" },
          { value: "4:3", label: "4:3" },
          { value: "3:4", label: "3:4" },
          { value: "3:2", label: "3:2" },
          { value: "2:3", label: "2:3" },
          { value: "4:5", label: "4:5" },
          { value: "5:4", label: "5:4" },
          { value: "21:9", label: "21:9" },
        ],
      },
      RESOLUTION,
    ],
    // Image generation → 20% target margin (1K→3, 2K→4, 4K→6).
    // Keep in sync with server/src/config/models/gpt-image-2.ts.
    credits: (params) => {
      const res = params.resolution ?? "2k";
      return res === "4k" ? 6 : res === "2k" ? 4 : 3;
    },
  },
};

export const MODEL_KEYS = Object.keys(MODEL_CONFIGS) as ModelKey[];

export const MODEL_PICKER_ITEMS = MODEL_KEYS.map((key) => {
  const m = MODEL_CONFIGS[key];
  return {
    key,
    label: m.label,
    sublabel: m.provider,
    title: `${m.description}. ${m.priceHint}`,
    iconSrc: m.icon,
  };
});

export function getDefaults(config: ImageModelConfig): Record<string, string> {
  return Object.fromEntries(
    config.params.map((p) => [p.key, p.defaultValue]),
  );
}

/** Stored model names (history rows) mapped to display labels. */
const STORED_MODEL_LABELS: Record<string, string> = {
  nano_banana_2: "Nano Banana 2",
  nano_banana_pro: "Nano Banana Pro",
  seedream_v5_lite: "Seedream v5 Lite",
  gpt_image_1_5: "GPT Image 1.5",
  "gpt_image_1.5": "GPT Image 1.5",
  gpt_image_2: "GPT Image 2",
};

export function imageModelLabel(model?: string | null): string | null {
  if (!model) return null;
  return (
    MODEL_CONFIGS[model as ModelKey]?.label ??
    STORED_MODEL_LABELS[model] ??
    model
  );
}

/** "2k" → "2K", Seedream quality names spelled out, sizes left as they are. */
export function formatResolution(value?: string | null): string | null {
  if (!value) return null;
  if (/^\d+k$/i.test(value)) return value.toUpperCase();
  if (value === "basic") return "Basic (2K)";
  if (value === "high") return "High (3K)";
  return value;
}
