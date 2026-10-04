/**
 * Generation model catalog — the curated list of WaveSpeed models the app
 * offers, grouped the way users pick them.
 *
 * This file only says WHICH WaveSpeed endpoints back each model and mode.
 * Each endpoint's inputs come live from WaveSpeed's own request schema (see
 * lib/wavespeed-catalog.ts), and its price comes from WaveSpeed's pricing API
 * at request time (see lib/generation-pricing.ts). Adding a model is a new
 * entry here and nothing else: no payload builder and no credit table.
 *
 * Mode routing: a mode lists one or more endpoints. The first endpoint whose
 * `when` media fields all have files is used, so "Text or image" can send a
 * prompt to text-to-video and switch to image-to-video once a start frame is
 * attached.
 */

export type CatalogCategory = "video" | "image" | "motion-control";

export interface CatalogEndpoint {
  /** WaveSpeed model id, e.g. "bytedance/seedance-2.5/text-to-video". */
  modelId: string;
  /** Media field keys that must all have files for this endpoint to apply. */
  when?: string[];
}

export interface CatalogMode {
  key: string;
  label: string;
  endpoints: CatalogEndpoint[];
  /** Per-mode field labels, e.g. `image` → "First frame". */
  labels?: Record<string, string>;
}

export interface CatalogModel {
  key: string;
  label: string;
  provider: string;
  /** Provider logo path under the client's /public. */
  icon: string;
  category: CatalogCategory;
  description: string;
  modes: CatalogMode[];
  /** Shown as a "New" tag in the model picker. */
  isNew?: boolean;
  /** Default values that override WaveSpeed's schema defaults. */
  defaults?: Record<string, string | number | boolean>;
  /** Extra schema fields to hide for this model. */
  hide?: string[];
  /** Older stored `model` values that should display as this model. */
  legacyDbModels?: string[];
}

// ─── Shared mode shapes ────────────────────────────────────────────────────

/** Text-to-video that switches to image-to-video once a start frame is attached. */
function textOrImage(base: string, frameLabel = "Start frame"): CatalogMode {
  return {
    key: "create",
    label: "Text or image",
    endpoints: [
      { modelId: `${base}/image-to-video`, when: ["image"] },
      { modelId: `${base}/text-to-video` },
    ],
    labels: {
      image: frameLabel,
      last_image: frameLabel === "First frame" ? "Last frame" : "End frame",
      end_image: "End frame",
    },
  };
}

function referenceMode(modelId: string): CatalogMode {
  return {
    key: "reference",
    label: "Reference",
    endpoints: [{ modelId }],
    labels: {
      images: "Reference images",
      reference_images: "Images",
      reference_videos: "Videos",
      reference_audios: "Audio",
      video: "Reference video",
    },
  };
}

/** Seedance: omni reference (images, videos, audio) or first/last frame. */
function seedanceModes(base: string, suffix = ""): CatalogMode[] {
  return [
    {
      key: "omni",
      label: "Omni reference",
      endpoints: [{ modelId: `${base}/text-to-video${suffix}` }],
      labels: {
        reference_images: "Images",
        reference_videos: "Videos",
        reference_audios: "Audio",
      },
    },
    {
      key: "frames",
      label: "First and last frame",
      endpoints: [{ modelId: `${base}/image-to-video${suffix}` }],
      labels: { image: "First frame", last_image: "Last frame" },
    },
  ];
}

/** Text-to-image that switches to the edit endpoint once images are attached. */
function textOrEdit(textModelId: string, editModelId: string): CatalogMode[] {
  return [
    {
      key: "create",
      label: "Create",
      endpoints: [
        { modelId: editModelId, when: ["images"] },
        { modelId: textModelId },
      ],
      labels: { images: "References" },
    },
  ];
}

function motionMode(modelId: string): CatalogMode[] {
  return [
    {
      key: "motion",
      label: "Motion control",
      endpoints: [{ modelId }],
      labels: { image: "Character image", video: "Motion video" },
    },
  ];
}

// ─── Video ─────────────────────────────────────────────────────────────────

const VIDEO: CatalogModel[] = [
  {
    key: "seedance-2.5",
    label: "Seedance 2.5",
    provider: "ByteDance",
    icon: "/models/bytedance.svg",
    category: "video",
    description: "ByteDance's newest model. Up to 30s, 4K, references and native audio",
    modes: seedanceModes("bytedance/seedance-2.5"),
    isNew: true,
  },
  {
    key: "seedance-2.5-turbo",
    label: "Seedance 2.5 Turbo",
    provider: "ByteDance",
    icon: "/models/bytedance.svg",
    category: "video",
    description: "Faster Seedance 2.5 at 720p or 1080p, much cheaper at 1080p",
    modes: seedanceModes("bytedance/seedance-2.5", "-turbo"),
    isNew: true,
  },
  {
    key: "seedance-2.0",
    label: "Seedance 2.0",
    provider: "ByteDance",
    icon: "/models/bytedance.svg",
    category: "video",
    description: "Motion-heavy video with image, video and audio references",
    modes: seedanceModes("bytedance/seedance-2.0"),
    legacyDbModels: ["seedance_2.0", "seedance_2_0", "seedance"],
  },
  {
    key: "seedance-2.0-fast",
    label: "Seedance 2.0 Fast",
    provider: "ByteDance",
    icon: "/models/bytedance.svg",
    category: "video",
    description: "Faster Seedance 2.0 with lower latency",
    modes: seedanceModes("bytedance/seedance-2.0-fast"),
    legacyDbModels: ["seedance_2.0_fast", "seedance_2_0_fast"],
  },
  {
    key: "seedance-2.0-mini",
    label: "Seedance 2.0 Mini",
    provider: "ByteDance",
    icon: "/models/bytedance.svg",
    category: "video",
    description: "Lowest-cost Seedance for high volume",
    modes: seedanceModes("bytedance/seedance-2.0-mini"),
    legacyDbModels: ["seedance_2.0_mini"],
  },
  {
    key: "veo-3.1",
    label: "Veo 3.1",
    provider: "Google",
    icon: "/models/google.svg",
    category: "video",
    description: "Google's highest fidelity video model, up to 4K with audio",
    modes: [
      textOrImage("google/veo3.1", "First frame"),
      referenceMode("google/veo3.1/reference-to-video"),
    ],
    legacyDbModels: ["veo3_1", "veo_3.1", "veo"],
  },
  {
    key: "veo-3.1-fast",
    label: "Veo 3.1 Fast",
    provider: "Google",
    icon: "/models/google.svg",
    category: "video",
    description: "Lower-cost Veo 3.1",
    modes: [
      textOrImage("google/veo3.1-fast", "First frame"),
      referenceMode("google/veo3.1-fast/reference-to-video"),
    ],
    legacyDbModels: ["veo3_1_fast", "veo-fast"],
  },
  {
    key: "veo-3.1-lite",
    label: "Veo 3.1 Lite",
    provider: "Google",
    icon: "/models/google.svg",
    category: "video",
    description: "Veo 3.1 for high volume",
    modes: [
      {
        key: "create",
        label: "Text or image",
        endpoints: [
          {
            modelId: "google/veo3.1-lite/start-end-to-video",
            when: ["image", "last_image"],
          },
          { modelId: "google/veo3.1-lite/image-to-video", when: ["image"] },
          { modelId: "google/veo3.1-lite/text-to-video" },
        ],
        labels: { image: "First frame", last_image: "Last frame" },
      },
    ],
    legacyDbModels: ["veo3_1_lite", "veo-lite"],
  },
  {
    key: "gemini-omni-1.1-flash",
    label: "Gemini Omni 1.1 Flash",
    provider: "Google",
    icon: "/models/google.svg",
    category: "video",
    description: "Fast video with native audio, up to 4K, from text, images or references",
    modes: [
      textOrImage("google/gemini-omni-1.1-flash"),
      referenceMode("google/gemini-omni-1.1-flash/reference-to-video"),
    ],
    isNew: true,
    legacyDbModels: ["gemini_omni_flash", "gemini-omni-flash"],
  },
  {
    key: "kling-o3-pro",
    label: "Kling O3 Pro",
    provider: "Kling",
    icon: "/models/kling.svg",
    category: "video",
    description: "Kling's newest model, with image and video references",
    modes: [
      textOrImage("kwaivgi/kling-video-o3-pro"),
      referenceMode("kwaivgi/kling-video-o3-pro/reference-to-video"),
    ],
    isNew: true,
  },
  {
    key: "kling-3.0-pro",
    label: "Kling 3.0 Pro",
    provider: "Kling",
    icon: "/models/kling.svg",
    category: "video",
    description: "Higher quality Kling output",
    modes: [textOrImage("kwaivgi/kling-v3.0-pro")],
    legacyDbModels: ["kling_v3_pro", "kling-pro"],
  },
  {
    key: "kling-3.0-std",
    label: "Kling 3.0 Standard",
    provider: "Kling",
    icon: "/models/kling.svg",
    category: "video",
    description: "General-purpose Kling video",
    modes: [textOrImage("kwaivgi/kling-v3.0-std")],
    legacyDbModels: ["kling_v3_std", "kling-standard"],
  },
  {
    key: "wan-3.0",
    label: "Wan 3.0",
    provider: "Alibaba",
    icon: "/models/alibaba.svg",
    category: "video",
    description: "Up to 30s with audio, from text, images or references",
    modes: [
      textOrImage("alibaba/wan-3.0"),
      referenceMode("alibaba/wan-3.0/reference-to-video"),
    ],
    isNew: true,
  },
  {
    key: "grok-imagine-video-1.5",
    label: "Grok Imagine Video 1.5",
    provider: "xAI",
    icon: "/models/xai.svg",
    category: "video",
    description: "Low-cost video from text, an image or references",
    modes: [
      textOrImage("x-ai/grok-imagine-video-v1.5"),
      referenceMode("x-ai/grok-imagine-video-v1.5/reference-to-video"),
    ],
    isNew: true,
  },
  {
    key: "sora-2",
    label: "Sora 2",
    provider: "OpenAI",
    icon: "/models/openai.svg",
    category: "video",
    description: "OpenAI video model",
    modes: [textOrImage("openai/sora-2")],
    legacyDbModels: ["sora_2"],
  },
  {
    key: "sora-2-pro",
    label: "Sora 2 Pro",
    provider: "OpenAI",
    icon: "/models/openai.svg",
    category: "video",
    description: "Higher fidelity Sora, up to 1080p",
    modes: [textOrImage("openai/sora-2-pro")],
    legacyDbModels: ["sora_2_pro"],
  },
];

// ─── Image ─────────────────────────────────────────────────────────────────

const IMAGE: CatalogModel[] = [
  {
    key: "gpt-image-2.5-flare",
    label: "GPT Image 2.5 Flare",
    provider: "OpenAI",
    icon: "/models/openai.svg",
    category: "image",
    description: "OpenAI's newest image model, fast tier, up to 4K",
    modes: textOrEdit(
      "openai/gpt-image-2.5-flare/text-to-image",
      "openai/gpt-image-2.5-flare/edit",
    ),
    isNew: true,
  },
  {
    key: "gpt-image-2.5-sunburst",
    label: "GPT Image 2.5 Sunburst",
    provider: "OpenAI",
    icon: "/models/openai.svg",
    category: "image",
    description: "GPT Image 2.5 precision tier for intricate detail",
    modes: textOrEdit(
      "openai/gpt-image-2.5-sunburst/text-to-image",
      "openai/gpt-image-2.5-sunburst/edit",
    ),
    isNew: true,
  },
  {
    key: "gpt-image-2",
    label: "GPT Image 2",
    provider: "OpenAI",
    icon: "/models/openai.svg",
    category: "image",
    description: "OpenAI image model with 4K output",
    modes: textOrEdit(
      "openai/gpt-image-2/text-to-image",
      "openai/gpt-image-2/edit",
    ),
    legacyDbModels: ["gpt_image_2"],
  },
  {
    key: "nano-banana-pro",
    label: "Nano Banana Pro",
    provider: "Google",
    icon: "/models/google.svg",
    category: "image",
    description: "Highest-fidelity Nano Banana with 4K output",
    modes: textOrEdit(
      "google/nano-banana-pro/text-to-image",
      "google/nano-banana-pro/edit",
    ),
    defaults: { resolution: "2k" },
  },
  {
    key: "nano-banana-2",
    label: "Nano Banana 2",
    provider: "Google",
    icon: "/models/google.svg",
    category: "image",
    description: "Fast, high-quality image generation and editing",
    modes: textOrEdit(
      "google/nano-banana-2/text-to-image",
      "google/nano-banana-2/edit",
    ),
    defaults: { resolution: "2k" },
  },
  {
    key: "nano-banana-2-lite",
    label: "Nano Banana 2 Lite",
    provider: "Google",
    icon: "/models/google.svg",
    category: "image",
    description: "Lowest-cost Nano Banana for high volume",
    modes: textOrEdit(
      "google/nano-banana-2-lite/text-to-image",
      "google/nano-banana-2-lite/edit",
    ),
    isNew: true,
  },
  {
    key: "seedream-5.0-pro",
    label: "Seedream 5.0 Pro",
    provider: "ByteDance",
    icon: "/models/bytedance.svg",
    category: "image",
    description: "ByteDance's newest image model with wide aspect ratio support",
    modes: textOrEdit(
      "bytedance/seedream-v5.0-pro",
      "bytedance/seedream-v5.0-pro/edit",
    ),
    isNew: true,
  },
];

// ─── Motion control ────────────────────────────────────────────────────────

const MOTION: CatalogModel[] = [
  {
    key: "kling-mc-3.0-pro",
    label: "Kling 3.0 Pro",
    provider: "Kling",
    icon: "/models/kling.svg",
    category: "motion-control",
    description: "Highest quality motion transfer, 1080p",
    modes: motionMode("kwaivgi/kling-v3.0-pro/motion-control"),
    legacyDbModels: ["kling_mc_3.0_pro"],
  },
  {
    key: "kling-mc-3.0-std",
    label: "Kling 3.0 Standard",
    provider: "Kling",
    icon: "/models/kling.svg",
    category: "motion-control",
    description: "Kling motion transfer at 720p",
    modes: motionMode("kwaivgi/kling-v3.0-std/motion-control"),
    legacyDbModels: ["kling_mc_3.0_std"],
  },
  {
    key: "kling-mc-2.6-pro",
    label: "Kling 2.6 Pro",
    provider: "Kling",
    icon: "/models/kling.svg",
    category: "motion-control",
    description: "Lower-cost Kling motion transfer",
    modes: motionMode("kwaivgi/kling-v2.6-pro/motion-control"),
    legacyDbModels: ["kling_mc_2.6_pro"],
  },
  {
    key: "wan-2.2-animate",
    label: "Wan 2.2 Animate",
    provider: "Alibaba",
    icon: "/models/alibaba.svg",
    category: "motion-control",
    description: "Low-cost character animation, driving videos up to 2 minutes",
    modes: motionMode("wavespeed-ai/wan-2.2/animate-2"),
    isNew: true,
  },
  {
    key: "dreamactor-v2",
    label: "DreamActor v2",
    provider: "ByteDance",
    icon: "/models/bytedance.svg",
    category: "motion-control",
    description: "Cheapest motion transfer, no prompt needed",
    modes: motionMode("bytedance/dreamactor-v2"),
    isNew: true,
  },
];

export const CATALOG: CatalogModel[] = [...VIDEO, ...IMAGE, ...MOTION];

export const CATALOG_BY_KEY: Record<string, CatalogModel> = Object.fromEntries(
  CATALOG.map((m) => [m.key, m]),
);

/**
 * A catalog model by key, or by an older name it replaced ("veo",
 * "kling-pro", "gemini-omni-flash") so existing API callers keep working.
 */
export function findCatalogModel(key: string): CatalogModel | undefined {
  return (
    CATALOG_BY_KEY[key] ?? CATALOG.find((m) => m.legacyDbModels?.includes(key))
  );
}

/** Stored `generation.model` values for catalog models of one category. */
export function catalogDbModels(category: CatalogCategory): string[] {
  return CATALOG.filter((m) => m.category === category).map((m) => m.key);
}
