import { Request, Response } from "express";
import { findCatalogModel } from "../config/catalog";
import { adaptLegacyInputs } from "../lib/wavespeed-catalog";
import {
  replayIdempotentResponse,
  saveIdempotentResponse,
} from "../lib/api-public";
import {
  sendCatalogError,
  startCatalogGeneration,
  type CatalogBody,
} from "./catalog.controller";

/**
 * Pre-catalog create endpoints (public `/api/v1/videos/create`,
 * `/image-generations/create`, `/motion-control/create`, and the old app
 * routes). Each keeps accepting its old request shape and old model names,
 * translates it into a catalog request, and runs through the same live
 * pricing and generation path as `/catalog/generate`.
 */

type Body = Record<string, unknown>;

/** Old model names with no catalog alias → their closest current model. */
const RETIRED_MODELS: Record<string, string> = {
  wan: "wan-3.0",
  "wan_2.6": "wan-3.0",
  "gpt-image-1.5": "gpt-image-2",
  "gpt_image_1.5": "gpt-image-2",
  gpt_image_1_5: "gpt-image-2",
  "seedream-v5-lite": "seedream-5.0-pro",
  seedream_v5_lite: "seedream-5.0-pro",
};

/** Old mode names → catalog mode keys. */
const MODE_ALIASES: Record<string, string> = {
  omni_reference: "omni",
  omni: "omni",
  first_last_frames: "frames",
  "first-last": "frames",
  "first-last-frame": "frames",
  FIRST_AND_LAST_FRAMES_2_VIDEO: "frames",
  REFERENCE_2_VIDEO: "reference",
  reference: "reference",
};

function pick(body: Body, ...keys: string[]): unknown {
  for (const key of keys) {
    const v = body[key];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function urls(value: unknown): string[] | undefined {
  if (typeof value === "string" && value) return [value];
  if (!Array.isArray(value)) return undefined;
  const list = value.filter((v): v is string => typeof v === "string" && !!v);
  return list.length ? list : undefined;
}

function modelKey(raw: unknown, fallback: string): string {
  const key = typeof raw === "string" && raw ? raw : fallback;
  return RETIRED_MODELS[key] ?? key;
}

/** The catalog mode for an old mode name, only if this model has it. */
function modeKey(model: string, raw: unknown): string | undefined {
  const alias = typeof raw === "string" ? MODE_ALIASES[raw] : undefined;
  if (!alias) return undefined;
  return findCatalogModel(model)?.modes.some((m) => m.key === alias)
    ? alias
    : undefined;
}

function set(inputs: Body, key: string, value: unknown) {
  if (value !== undefined) inputs[key] = value;
}

// ─── Translators ───────────────────────────────────────────────────────────

export async function legacyVideoBody(
  body: Body,
  defaults: { model: string; audio?: boolean } = { model: "seedance-2.0" },
): Promise<CatalogBody> {
  const model = modelKey(body.model, defaults.model);
  const inputs: Body = {};

  set(inputs, "prompt", body.prompt);
  set(inputs, "negative_prompt", pick(body, "negativePrompt", "negative_prompt"));
  const ratio = pick(body, "aspectRatio", "aspect", "aspect_ratio", "ratio");
  if (ratio !== "auto") set(inputs, "aspect_ratio", ratio);
  set(inputs, "duration", pick(body, "duration"));
  set(inputs, "resolution", pick(body, "resolution"));

  const audio = pick(body, "sound", "generateAudio", "generate_audio") ?? defaults.audio;
  if (audio !== undefined) {
    // Each model reads whichever of these it has.
    inputs.generate_audio = Boolean(audio);
    inputs.sound = Boolean(audio);
  }

  const rawMode = pick(body, "mode", "functionMode");
  const frames = urls(body.filePaths) ?? [];
  const imageUrls = urls(body.imageUrls) ?? [];
  const isReference = rawMode === "REFERENCE_2_VIDEO" || rawMode === "reference";

  const start =
    pick(body, "image", "startFrame", "start_frame") ??
    frames[0] ??
    (isReference ? undefined : imageUrls[0]);
  const end =
    pick(body, "lastImage", "last_image", "end_image", "endImage", "endFrame", "end_frame") ??
    frames[1] ??
    (isReference ? undefined : imageUrls[1]);
  set(inputs, "image", start);
  if (end !== undefined) {
    inputs.last_image = end;
    inputs.end_image = end;
  }

  set(
    inputs,
    "reference_images",
    urls(pick(body, "referenceImages", "reference_images", "image_files")) ??
      (isReference && imageUrls.length ? imageUrls : undefined),
  );
  set(inputs, "reference_videos", urls(pick(body, "referenceVideos", "reference_videos", "video_files")));
  set(inputs, "reference_audios", urls(pick(body, "referenceAudios", "reference_audios", "audio_files")));

  return {
    category: "video",
    model,
    mode: modeKey(model, rawMode),
    inputs: await adaptLegacyInputs(model, inputs),
  };
}

export async function legacyImageBody(body: Body): Promise<CatalogBody> {
  const model = modelKey(body.model, "nano-banana-2");
  const inputs: Body = {};

  set(inputs, "prompt", body.prompt);
  const ratio = pick(body, "aspectRatio", "aspect", "aspect_ratio", "ratio");
  if (ratio !== "auto") set(inputs, "aspect_ratio", ratio);
  // Old Seedream ("basic"/"high") and GPT Image 1.5 ("1024x1024") values have
  // no catalog equivalent; those fall back to the model's default.
  const resolution = pick(body, "resolution");
  if (typeof resolution === "string" && /^\d+(\.\d+)?k$/i.test(resolution)) {
    inputs.resolution = resolution.toLowerCase();
  }
  set(inputs, "quality", pick(body, "quality"));
  set(
    inputs,
    "images",
    urls(pick(body, "referenceImages", "referenceImageUrls", "referenceImageUrl", "images")),
  );

  return {
    category: "image",
    model,
    inputs: await adaptLegacyInputs(model, inputs),
  };
}

export async function legacyMotionBody(body: Body): Promise<CatalogBody> {
  const model = modelKey(body.model, "kling-mc-3.0-pro");
  const inputs: Body = {};

  set(inputs, "prompt", body.prompt);
  set(inputs, "image", pick(body, "character_image_url", "characterImageUrl", "image"));
  set(inputs, "video", pick(body, "motion_video_url", "motionVideoUrl", "video"));
  set(inputs, "keep_original_sound", pick(body, "keep_sound", "keepSound", "keep_original_sound"));
  set(inputs, "character_orientation", pick(body, "character_orientation", "characterOrientation"));

  return { category: "motion-control", model, inputs };
}

// ─── Handler ───────────────────────────────────────────────────────────────

/** An express handler that translates an old create request and runs it. */
export function legacyCreate(translate: (body: Body) => Promise<CatalogBody>) {
  return async (req: Request, res: Response) => {
    try {
      if (await replayIdempotentResponse(req, res)) return;
      const result = await startCatalogGeneration(req, await translate(req.body ?? {}));
      if (result.status === 200) {
        await saveIdempotentResponse(req, 200, result.body);
      }
      return res.status(result.status).json(result.body);
    } catch (error) {
      return sendCatalogError(res, error, "legacy create");
    }
  };
}
