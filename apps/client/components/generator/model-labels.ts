/**
 * Display labels for stored `model` values the live catalog doesn't cover:
 * models no longer offered and older spellings of current ones. Pages try
 * `useCatalogLabel` first and fall back to these.
 */

const VIDEO_LABELS: Record<string, string> = {
  seedance: "Seedance 2.0",
  "seedance-fast": "Seedance 2.0 Fast",
  "seedance-mini": "Seedance 2.0 Mini",
  "seedance_2.0": "Seedance 2.0",
  seedance_2_0: "Seedance 2.0",
  "seedance_2.0_fast": "Seedance 2.0 Fast",
  seedance_2_0_fast: "Seedance 2.0 Fast",
  "seedance_2.0_mini": "Seedance 2.0 Mini",
  "kling-standard": "Kling 3.0 Standard",
  "kling-pro": "Kling 3.0 Pro",
  kling_v3_std: "Kling 3.0 Standard",
  kling_v3_pro: "Kling 3.0 Pro",
  veo: "Veo 3.1",
  "veo-fast": "Veo 3.1 Fast",
  "veo-lite": "Veo 3.1 Lite",
  veo3_1: "Veo 3.1",
  veo3_1_fast: "Veo 3.1 Fast",
  veo3_1_lite: "Veo 3.1 Lite",
  "veo_3.1": "Veo 3.1",
  "gemini-omni-flash": "Gemini Omni Flash",
  gemini_omni_flash: "Gemini Omni Flash",
  "sora-2": "Sora 2",
  "sora-2-pro": "Sora 2 Pro",
  sora_2: "Sora 2",
  sora_2_pro: "Sora 2 Pro",
  "wan_2.6": "Wan 2.6",
  wan: "Wan 2.6",
};

const IMAGE_LABELS: Record<string, string> = {
  "nano-banana-2": "Nano Banana 2",
  "nano-banana-pro": "Nano Banana Pro",
  nano_banana_2: "Nano Banana 2",
  nano_banana_pro: "Nano Banana Pro",
  "seedream-v5-lite": "Seedream v5 Lite",
  seedream_v5_lite: "Seedream v5 Lite",
  "gpt-image-1.5": "GPT Image 1.5",
  gpt_image_1_5: "GPT Image 1.5",
  "gpt_image_1.5": "GPT Image 1.5",
  "gpt-image-2": "GPT Image 2",
  gpt_image_2: "GPT Image 2",
};

const MOTION_LABELS: Record<string, string> = {
  "kling_mc_3.0_pro": "Kling 3.0 Pro",
  "kling_mc_3.0_std": "Kling 3.0 Standard",
  "kling_mc_2.6_pro": "Kling 2.6 Pro",
};

export function videoModelLabel(model: string): string {
  return VIDEO_LABELS[model] ?? model;
}

export function imageModelLabel(model?: string | null): string | null {
  if (!model) return null;
  return IMAGE_LABELS[model] ?? model;
}

export function motionModelLabel(model?: string | null): string | null {
  if (!model) return null;
  return MOTION_LABELS[model] ?? model;
}

/** "2k" → "2K", Seedream quality names spelled out, sizes left as they are. */
export function formatResolution(value?: string | null): string | null {
  if (!value || value === "auto") return null;
  if (/^\d+(\.\d+)?k$/i.test(value)) return value.toUpperCase();
  if (value === "basic") return "Basic (2K)";
  if (value === "high") return "High (3K)";
  return value;
}
