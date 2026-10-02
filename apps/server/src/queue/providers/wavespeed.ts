import { getWavespeedClient } from "../../lib/wavespeed-api";
import type { VideoModelConfig } from "../../config/models";
import type { VideoGenerationJobData } from "../video-generation.queue";

const SORA2_SIZE_MAP: Record<string, string> = {
  "16:9": "1280*720",
  "9:16": "720*1280",
};

const SORA2_PRO_SIZE_MAP: Record<string, string> = {
  "16:9": "1920*1080",
  "9:16": "1080*1920",
  "7:4": "1792*1024",
  "4:7": "1024*1792",
};

function resolveSoraSize(modelKey: string, aspectRatio: string): string {
  const map =
    modelKey === "sora-2-pro" ? SORA2_PRO_SIZE_MAP : SORA2_SIZE_MAP;
  return map[aspectRatio] ?? map["16:9"];
}

/** True when the request carries any input frame (start, end, or reference). */
function hasInputFrame(data: VideoGenerationJobData): boolean {
  return !!(
    data.image ||
    data.startFrame ||
    (data.imageUrls && data.imageUrls.length > 0)
  );
}

// ── Veo 3.1 (mode-routed) ───────────────────────────────────────────────────
// Each Veo "mode" is a distinct WaveSpeed endpoint with its own payload shape:
//   • text-to-video        — prompt + aspect_ratio + duration
//   • image-to-video       — + image (start frame); optional last_image (end)
//   • start-end-to-video   — image + last_image (Lite only; Std/Fast fold this
//                            into image-to-video via last_image)
//   • reference-to-video   — images[] (up to 3); no aspect_ratio/duration
type VeoEndpointKind = "text" | "image" | "startEnd" | "reference";

/** Pick the right Veo endpoint URL + payload shape for the requested mode. */
function resolveVeoEndpoint(
  modelDef: VideoModelConfig,
  data: VideoGenerationJobData,
): { url: string; kind: VeoEndpointKind } {
  const e = modelDef.endpoints ?? {};

  if (data.mode === "REFERENCE_2_VIDEO" && e.referenceToVideo) {
    return { url: e.referenceToVideo, kind: "reference" };
  }

  if (data.mode === "FIRST_AND_LAST_FRAMES_2_VIDEO") {
    // Lite has a dedicated endpoint; Std/Fast use image-to-video + last_image.
    if (e.startEndToVideo) return { url: e.startEndToVideo, kind: "startEnd" };
    if (e.imageToVideo) return { url: e.imageToVideo, kind: "startEnd" };
  }

  if (hasInputFrame(data) && e.imageToVideo) {
    return { url: e.imageToVideo, kind: "image" };
  }

  return { url: e.textToVideo ?? "", kind: "text" };
}

/** Build the Veo payload, emitting only the fields the chosen endpoint accepts. */
function buildVeoPayload(
  data: VideoGenerationJobData,
  kind: VeoEndpointKind,
): Record<string, unknown> {
  const { prompt, negativePrompt, duration, sound } = data;
  const resolution = data.resolution || "1080p";
  const aspectRatio =
    data.aspectRatio && data.aspectRatio !== "auto" ? data.aspectRatio : "16:9";

  const payload: Record<string, unknown> = {
    prompt,
    resolution,
    generate_audio: sound,
  };
  if (negativePrompt) payload.negative_prompt = negativePrompt;

  if (kind === "reference") {
    const refs = data.referenceImages?.length
      ? data.referenceImages
      : data.imageUrls ?? [];
    payload.images = refs.slice(0, 3);
    return payload;
  }

  if (kind === "startEnd") {
    const start = data.image || data.startFrame || data.imageUrls?.[0];
    const end = data.endImage || data.endFrame || data.imageUrls?.[1];
    if (start) payload.image = start;
    if (end) payload.last_image = end;
    return payload;
  }

  // text-to-video / image-to-video
  payload.aspect_ratio = aspectRatio;
  payload.duration = duration;
  if (kind === "image") {
    const start = data.image || data.startFrame || data.imageUrls?.[0];
    if (start) payload.image = start;
    const end = data.endImage || data.endFrame || data.imageUrls?.[1];
    if (end) payload.last_image = end;
  }
  return payload;
}

export function buildWavespeedPayload(
  data: VideoGenerationJobData,
  isImageMode: boolean,
): Record<string, unknown> {
  const { modelKey, prompt, negativePrompt, duration, sound } = data;

  const payload: Record<string, unknown> = { prompt, duration };

  if (negativePrompt) payload.negative_prompt = negativePrompt;

  if (modelKey.startsWith("kling")) {
    payload.cfg_scale = 0.5;
    payload.multi_prompt = [];
    payload.sound = sound;

    if (isImageMode) {
      payload.image = data.image || "";
      payload.end_image = data.endImage || "";
    } else {
      payload.aspect_ratio = data.aspectRatio;
    }
  } else if (modelKey.startsWith("sora")) {
    if (isImageMode) {
      payload.image = data.image || "";
      if (modelKey === "sora-2-pro") {
        payload.resolution = "1080p";
      }
    } else {
      payload.size = resolveSoraSize(modelKey, data.aspectRatio);
    }
  } else if (modelKey === "wan") {
    if (isImageMode) {
      payload.image = data.image || "";
      payload.resolution = data.resolution || "720p";
    } else {
      payload.size = data.aspectRatio;
    }
  } else if (modelKey.startsWith("seedance")) {
    payload.aspect_ratio = data.aspectRatio;
    payload.resolution = data.resolution || "720p";
    payload.generate_audio = data.generateAudio ?? false;
    if (data.referenceImages?.length) {
      payload.reference_images = data.referenceImages;
    }
    if (data.referenceVideos?.length) {
      payload.reference_videos = data.referenceVideos;
    }
    if (data.referenceAudios?.length) {
      payload.reference_audios = data.referenceAudios;
    }
    if (isImageMode) {
      const start = data.image || data.startFrame;
      const end = data.endImage || data.endFrame;
      if (start) payload.image = start;
      if (end) payload.last_image = end;
    }
  } else if (modelKey === "gemini-omni-flash") {
    payload.aspect_ratio = data.aspectRatio;
    if (isImageMode) {
      payload.image = data.image || data.startFrame || "";
    }
  }

  return payload;
}

export async function submitWavespeed(
  modelDef: VideoModelConfig,
  data: VideoGenerationJobData,
): Promise<string> {
  const client = getWavespeedClient();

  // Veo routes per mode to distinct endpoints with mode-specific payloads.
  if (data.modelKey.startsWith("veo")) {
    const { url, kind } = resolveVeoEndpoint(modelDef, data);
    if (!url) {
      throw new Error(
        `No Veo endpoint configured for mode "${data.mode}" on ${data.modelKey}`,
      );
    }
    return client.submit(url, buildVeoPayload(data, kind));
  }

  // Omni Flash: reference images route to the reference-to-video endpoint
  // (a single start image goes through image-to-video below instead).
  if (
    data.modelKey === "gemini-omni-flash" &&
    data.referenceImages?.length &&
    modelDef.endpoints?.referenceToVideo
  ) {
    return client.submit(modelDef.endpoints.referenceToVideo, {
      prompt: data.prompt,
      duration: data.duration,
      aspect_ratio: data.aspectRatio,
      images: data.referenceImages.slice(0, 4),
    });
  }

  const isImageMode = hasInputFrame(data);
  const endpoint = isImageMode
    ? modelDef.endpoints?.imageToVideo
    : modelDef.endpoints?.textToVideo;
  if (!endpoint) {
    throw new Error(
      `No ${isImageMode ? "image-to-video" : "text-to-video"} endpoint for ${data.modelKey}`,
    );
  }
  const payload = buildWavespeedPayload(data, isImageMode);

  return client.submit(endpoint, payload);
}

export async function pollWavespeed(taskId: string) {
  return getWavespeedClient().poll(taskId);
}
