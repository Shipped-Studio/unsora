import { task, wait } from "@trigger.dev/sdk";
import prisma from "../lib/db";
import { uploadUrlToStorage, uploadVideoToStorage } from "../lib/upload";
import { STANDARD_RETRY, CANCELLED_ERROR } from "./task-utils";
import { VIDEO_MODELS, type VideoModelConfig } from "../config/models";
import { createAsset } from "../lib/asset-utils";
import { submitWavespeed, pollWavespeed } from "./providers/wavespeed";
import { submitKie, pollKie } from "./providers/kie";
import { refundConsumption } from "../lib/credits";
import { convertToChinese } from "../lib/refine-prompt";
import { KieAPI, getKieClient, parseKieJobMediaUrls } from "../lib/kie-api";
import { getWavespeedClient } from "../lib/wavespeed-api";

/**
 * Unified video-generation queue. Every video generation provider — Seedance
 * (Kie), Kling, Kling motion-control, and the model-config-driven providers —
 * runs through the single `videoGenerationTask`. The four `addXJob` producers
 * tag the payload with a `kind` discriminator; the controllers that call them
 * are unchanged.
 *
 * All four share the same shape downstream: a `prisma.generation` row keyed by
 * `generationId`, status PROCESSING -> COMPLETED/FAILED, a provider `taskId`,
 * an output VIDEO asset, and a credit refund on terminal failure.
 */

// ── Payload interfaces (stable; consumed by the existing producers) ──────

/** Seedance (Kie). */
export interface GenerationJobData {
  userId: string;
  generationId: string;
  creditsUsed: number;
  /** Credit transaction id to refund on failure. Optional for admin retries. */
  creditTransactionId?: string;
  apiBody: {
    model: string;
    prompt: string;
    functionMode: string;
    ratio: string;
    duration: number;
    resolution: string;
    image_files?: string[];
    video_files?: string[];
    audio_files?: string[];
    filePaths?: string[];
    generate_audio?: boolean;
  };
}

/** Kling (WaveSpeed). */
export interface KlingGenerationJobData {
  userId: string;
  generationId: string;
  creditsUsed: number;
  creditTransactionId?: string;
  prompt: string;
  aspectRatio: string;
  cfgScale: number;
  duration: number;
  sound: boolean;
  image?: string;
  endImage?: string;
}

/** Kling motion-control (WaveSpeed). */
export interface MotionControlJobData {
  userId: string;
  generationId: string;
  creditsUsed: number;
  creditTransactionId?: string;
  model: string;
  prompt: string;
  motionVideoUrl: string;
  characterImageUrl: string;
  resolution: string;
  keepSound: boolean;
  characterOrientation: "video" | "image";
}

/** Model-config-driven multi-provider generation. */
export interface VideoGenerationJobData {
  userId: string;
  generationId: string;
  creditsUsed: number;
  creditTransactionId?: string;
  modelKey: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  duration: number;
  resolution?: string;
  sound: boolean;
  mode?: string;
  image?: string;
  endImage?: string;
  referenceImages?: string[];
  referenceVideos?: string[];
  referenceAudios?: string[];
  generateAudio?: boolean;
  startFrame?: string;
  endFrame?: string;
  audio?: string;
  imageUrls?: string[];
}

export interface GenerationJobResult {
  success: boolean;
  generationId: string;
  outputUrl?: string;
  error?: string;
}
export type KlingGenerationJobResult = GenerationJobResult;
export type MotionControlJobResult = GenerationJobResult;
export type VideoGenerationJobResult = GenerationJobResult;

/** Discriminated union actually sent to the unified task. */
type VideoTaskPayload =
  | ({ kind: "seedance" } & GenerationJobData)
  | ({ kind: "kling" } & KlingGenerationJobData)
  | ({ kind: "motion-control" } & MotionControlJobData)
  | ({ kind: "model" } & VideoGenerationJobData);

interface ProviderOutput {
  providerVideoUrl: string;
  thumbnailUrl?: string;
}

// ── Seedance (Kie) ───────────────────────────────────────────────────────

/** Kie unified task polling — see https://docs.kie.ai/market/common/get-task-detail */
const POLL_INTERVAL_SECONDS = 10;
const MAX_POLL_ATTEMPTS = 1800; // ~5 hours at 10s intervals
const MAX_RESUBMIT_ATTEMPTS = 3;

function thumbnailFromKieResult(resultJson?: string): string | undefined {
  if (!resultJson?.trim()) return undefined;
  try {
    const parsed = JSON.parse(resultJson) as Record<string, unknown>;
    for (const key of ["thumbnail_url", "thumbnailUrl", "cover_url"]) {
      const v = parsed[key];
      if (typeof v === "string") return v;
    }
    const out = parsed.output;
    if (out && typeof out === "object") {
      const o = out as Record<string, unknown>;
      for (const key of ["thumbnail_url", "thumbnailUrl"]) {
        const v = o[key];
        if (typeof v === "string") return v;
      }
    }
  } catch {
    /* ignore malformed JSON */
  }
  return undefined;
}

const ERROR_CODE_MESSAGES: Record<number, string> = {
  1000: "Invalid parameter.",
  1001: "Video generation failed.",
  4011: "The system detected facial information in the uploaded footage. Please adjust the footage and try again.",
  2038: "The content violates regulations. Please modify the message.",
  2042: "The content violates regulations. Please modify the message.",
  2043: "Video review failed, please replace the video.",
};

function resolveTaskError(output: {
  error?: string;
  error_type?: string;
  raw_error?: string;
}): string {
  const errorStr = output?.raw_error || output?.error;
  if (!errorStr) return "Generation failed with an unknown error.";

  if (/system busy/i.test(errorStr)) {
    return "System busy, please try again later.";
  }

  const codeMatch =
    errorStr.match(/(?:错误码|error.?code)[:\s]*(\d+)/i) ||
    errorStr.match(/(\d{4,})\s*$/);
  if (codeMatch) {
    const code = parseInt(codeMatch[1], 10);
    const mapped = ERROR_CODE_MESSAGES[code];
    if (mapped) return mapped;
  }
  return errorStr.trim();
}

async function submitSeedanceToKie(
  kie: KieAPI,
  apiBody: GenerationJobData["apiBody"],
): Promise<string> {
  const chinesePrompt = await convertToChinese(apiBody.prompt);
  const prompt = chinesePrompt || apiBody.prompt;

  const { model, input } = KieAPI.seedanceVideoTask(prompt, apiBody);
  const cbUrl = process.env.KIE_SEEDANCE_CALLBACK_URL?.trim();
  return kie.submit(model, input, cbUrl ? { callBackUrl: cbUrl } : undefined);
}

async function runSeedance(
  data: GenerationJobData,
  existingTaskId: string | null,
  runId: string,
): Promise<ProviderOutput> {
  const kie = getKieClient();
  const { generationId, apiBody } = data;

  let taskId = existingTaskId;
  let resubmitCount = 0;

  if (!taskId) {
    taskId = await submitSeedanceToKie(kie, apiBody);
    await prisma.generation.update({
      where: { id: generationId },
      data: { taskId },
    });
  }

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await wait.for({ seconds: POLL_INTERVAL_SECONDS });

    const record = await kie.fetchJobRecord(taskId);
    if (!record || record.code !== 200 || !record.data) {
      continue;
    }

    const taskData = record.data;

    if (taskData.state === "success") {
      const mediaUrls = parseKieJobMediaUrls(taskData.resultJson);
      const providerVideoUrl = mediaUrls[0];
      const thumbnailUrl =
        thumbnailFromKieResult(taskData.resultJson) ?? mediaUrls[1];

      if (!providerVideoUrl) {
        throw new Error("No video URL returned from Kie");
      }

      return { providerVideoUrl, thumbnailUrl };
    }

    if (taskData.state === "fail") {
      console.error(
        `[Generation ${runId}] Kie Seedance task failed:`,
        JSON.stringify({
          failMsg: taskData.failMsg,
          failCode: taskData.failCode,
        }),
      );

      const rawFail = `${taskData.failMsg ?? ""} ${taskData.failCode ?? ""}`;
      const isSystemBusy =
        /system busy|rate.?limit|429|too many requests|overload/i.test(rawFail);
      if (isSystemBusy && resubmitCount < MAX_RESUBMIT_ATTEMPTS) {
        resubmitCount++;

        taskId = await submitSeedanceToKie(kie, apiBody);
        await prisma.generation.update({
          where: { id: generationId },
          data: { taskId },
        });

        continue;
      }

      const errorMsg = resolveTaskError({
        error: taskData.failMsg,
        raw_error: rawFail,
      });
      throw new Error(errorMsg);
    }

    // waiting | queuing | generating — continue polling
  }

  throw new Error(
    `Generation timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_SECONDS}s`,
  );
}

// ── Kling (WaveSpeed) ──────────────────────────────────────────────────────

async function runKling(
  data: KlingGenerationJobData,
  existingTaskId: string | null,
): Promise<ProviderOutput> {
  const client = getWavespeedClient();
  const { generationId, prompt, aspectRatio, cfgScale, duration, sound, image, endImage } =
    data;

  let taskId = existingTaskId;

  if (!taskId) {
    const isImageMode = !!image;
    const endpoint = isImageMode
      ? "kwaivgi/kling-v3.0-pro/image-to-video"
      : "kwaivgi/kling-v3.0-pro/text-to-video";

    const submitBody: Record<string, unknown> = {
      prompt,
      cfg_scale: cfgScale,
      duration,
      multi_prompt: [],
      sound: !!sound,
    };

    if (isImageMode) {
      submitBody.image = image || "";
      submitBody.end_image = endImage || "";
    } else {
      submitBody.aspect_ratio = aspectRatio;
    }

    taskId = await client.submit(endpoint, submitBody);
    await prisma.generation.update({
      where: { id: generationId },
      data: { taskId },
    });
  }

  const result = await client.poll(taskId);

  if (result.status === "failed") {
    throw new Error(result.error || "Kling video generation failed");
  }

  const providerVideoUrl = result.outputs[0];
  if (!providerVideoUrl) {
    throw new Error("No video URL returned from provider");
  }

  return { providerVideoUrl };
}

// ── Kling motion-control (WaveSpeed) ───────────────────────────────────────

const WAVESPEED_MODEL_MAP: Record<string, string> = {
  "kling_mc_2.6_pro": "kwaivgi/kling-v2.6-pro/motion-control",
  "kling_mc_3.0_pro": "kwaivgi/kling-v3.0-pro/motion-control",
  "kling_mc_3.0_std": "kwaivgi/kling-v3.0-std/motion-control",
};

async function runMotionControl(
  data: MotionControlJobData,
  existingTaskId: string | null,
): Promise<ProviderOutput> {
  const client = getWavespeedClient();
  const {
    generationId,
    model,
    prompt,
    motionVideoUrl,
    characterImageUrl,
    keepSound,
    characterOrientation,
  } = data;

  let taskId = existingTaskId;

  if (!taskId) {
    const endpoint =
      WAVESPEED_MODEL_MAP[model] ?? WAVESPEED_MODEL_MAP["kling_mc_3.0_pro"];

    const submitBody: Record<string, unknown> = {
      prompt,
      video: motionVideoUrl,
      image: characterImageUrl,
      keep_original_sound: keepSound,
      character_orientation: characterOrientation,
      shot_type: "customize",
      element_list: [],
    };

    taskId = await client.submit(endpoint, submitBody);
    await prisma.generation.update({
      where: { id: generationId },
      data: { taskId },
    });
  }

  const result = await client.poll(taskId);

  if (result.status === "failed") {
    throw new Error(result.error || "Motion control generation failed");
  }

  const providerVideoUrl = result.outputs[0];
  if (!providerVideoUrl) {
    throw new Error("No video URL returned from provider");
  }

  return { providerVideoUrl };
}

// ── Model-config-driven providers ──────────────────────────────────────────

interface ProviderResult {
  outputs: string[];
  status: "completed" | "failed";
  error?: string;
}

async function submitToProvider(
  modelDef: VideoModelConfig,
  data: VideoGenerationJobData,
): Promise<string> {
  if (modelDef.provider === "wavespeed" && modelDef.endpoints) {
    return submitWavespeed(modelDef, data);
  }

  if (modelDef.provider === "kie") {
    return submitKie(modelDef, data);
  }

  throw new Error(`Unsupported provider for model: ${data.modelKey}`);
}

async function pollProvider(
  modelDef: VideoModelConfig,
  taskId: string,
): Promise<ProviderResult> {
  if (modelDef.provider === "wavespeed") {
    return pollWavespeed(taskId);
  }

  if (modelDef.provider === "kie") {
    return pollKie(taskId);
  }

  throw new Error("Unsupported provider");
}

async function runModel(
  data: VideoGenerationJobData,
  existingTaskId: string | null,
): Promise<ProviderOutput> {
  const modelDef = VIDEO_MODELS[data.modelKey];
  if (!modelDef) throw new Error(`Unknown model: ${data.modelKey}`);

  let taskId = existingTaskId;

  if (!taskId) {
    taskId = await submitToProvider(modelDef, data);
    await prisma.generation.update({
      where: { id: data.generationId },
      data: { taskId },
    });
  }

  const result = await pollProvider(modelDef, taskId);

  if (result.status === "failed") {
    throw new Error(result.error || "Video generation failed");
  }

  const providerVideoUrl = result.outputs[0];
  if (!providerVideoUrl) {
    throw new Error("No video URL returned from provider");
  }

  return { providerVideoUrl };
}

// ── Unified task ───────────────────────────────────────────────────────────

const REFUND_EVENT: Record<VideoTaskPayload["kind"], string> = {
  seedance: "video.generation.seedance.failed",
  kling: "video.generation.kling.failed",
  "motion-control": "video.generation.motion-control.failed",
  model: "video.generation.failed",
};

const CANCEL_EVENT: Record<VideoTaskPayload["kind"], string> = {
  seedance: "video.generation.seedance.cancelled",
  kling: "video.generation.kling.cancelled",
  "motion-control": "video.generation.motion-control.cancelled",
  model: "video.generation.cancelled",
};

// Shared terminal handler for onFailure/onCancel: mark the row and refund once.
async function finalizeGeneration(
  payload: VideoTaskPayload,
  errorText: string,
  refundReason: string,
) {
  const { generationId, creditTransactionId } = payload;

  try {
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: "FAILED", error: errorText },
    });

    if (creditTransactionId) {
      await refundConsumption(creditTransactionId, refundReason, {
        generationId,
      });
    }
  } catch (refundError) {
    console.error(
      `[VideoGen ${generationId}] Failed to update DB/refund:`,
      refundError,
    );
  }
}

export const videoGenerationTask = task({
  id: "video-generation",
  // One shared pool for all video generation. Was 4 queues × 3 each; tune to
  // taste — concurrencyKey could split this per provider if needed.
  queue: { concurrencyLimit: 10 },
  retry: STANDARD_RETRY,
  run: async (
    payload: VideoTaskPayload,
    { ctx },
  ): Promise<GenerationJobResult> => {
    const { userId, generationId } = payload;

    const record = await prisma.generation.findUnique({
      where: { id: generationId },
      select: { taskId: true },
    });
    if (!record) throw new Error(`Record not found: ${generationId}`);

    await prisma.generation.update({
      where: { id: generationId },
      data: { status: "PROCESSING" },
    });

    const existingTaskId = record.taskId;

    let output: ProviderOutput;
    switch (payload.kind) {
      case "seedance":
        output = await runSeedance(payload, existingTaskId, ctx.run.id);
        break;
      case "kling":
        output = await runKling(payload, existingTaskId);
        break;
      case "motion-control":
        output = await runMotionControl(payload, existingTaskId);
        break;
      case "model":
        output = await runModel(payload, existingTaskId);
        break;
    }

    // ── Shared finalize: mirror to storage, create assets, mark COMPLETED ──
    const uploadResult = await uploadVideoToStorage(output.providerVideoUrl);
    const outputUrl =
      uploadResult.success && uploadResult.fileUrl
        ? uploadResult.fileUrl
        : output.providerVideoUrl;

    const outputAsset = await createAsset({
      userId,
      url: outputUrl,
      name: `Generation ${generationId}`,
      type: "VIDEO",
      source: "GENERATION",
    });

    let thumbnailAssetId: string | undefined;
    if (output.thumbnailUrl) {
      const thumbUpload = await uploadUrlToStorage(
        output.thumbnailUrl,
        `generation-${generationId}-thumbnail`,
        "video-generations/thumbnails",
      );
      const thumbAsset = await createAsset({
        userId,
        url:
          thumbUpload.success && thumbUpload.fileUrl
            ? thumbUpload.fileUrl
            : output.thumbnailUrl,
        name: `Generation ${generationId} thumbnail`,
        type: "IMAGE",
        source: "GENERATION",
      });
      thumbnailAssetId = thumbAsset.id;
    }

    await prisma.generation.update({
      where: { id: generationId },
      data: {
        status: "COMPLETED",
        outputAssetId: outputAsset.id,
        thumbnailAssetId,
      },
    });

    // Credit accounting was already settled at queue time via consumeCredits().

    return { success: true, generationId, outputUrl };
  },
  // Runs only after all retries are exhausted.
  onFailure: async ({ payload, error }) => {
    const message = error instanceof Error ? error.message : String(error);
    // Seedance preserves the resolved message verbatim; the others historically
    // surfaced the third ":"-delimited segment of the provider error.
    const errorText =
      payload.kind === "seedance"
        ? message
        : message.split(":")[2]?.trim() || message;

    await finalizeGeneration(payload, errorText, REFUND_EVENT[payload.kind]);
  },
  // Cancelled runs skip onFailure, so terminal cleanup must happen here too.
  onCancel: async ({ payload }) => {
    await finalizeGeneration(payload, CANCELLED_ERROR, CANCEL_EVENT[payload.kind]);
  },
});

// ── Producers (names + signatures unchanged; controllers untouched) ──────────

export const addGenerationJob = async (
  jobData: GenerationJobData,
  options?: { priority?: number; delay?: number },
) => {
  const handle = await videoGenerationTask.trigger(
    { kind: "seedance", ...jobData },
    { delay: options?.delay ? new Date(Date.now() + options.delay) : undefined },
  );
  return { id: handle.id };
};

export const addKlingGenerationJob = async (
  jobData: KlingGenerationJobData,
  options?: { priority?: number; delay?: number },
) => {
  const handle = await videoGenerationTask.trigger(
    { kind: "kling", ...jobData },
    {
      delay: options?.delay ? new Date(Date.now() + options.delay) : undefined,
      maxAttempts: 2,
    },
  );
  return { id: handle.id };
};

export const addMotionControlJob = async (
  jobData: MotionControlJobData,
  options?: { priority?: number; delay?: number },
) => {
  const handle = await videoGenerationTask.trigger(
    { kind: "motion-control", ...jobData },
    {
      delay: options?.delay ? new Date(Date.now() + options.delay) : undefined,
      maxAttempts: 2,
    },
  );
  return { id: handle.id };
};

export const addVideoGenerationJob = async (
  jobData: VideoGenerationJobData,
  options?: { priority?: number; delay?: number },
) => {
  const handle = await videoGenerationTask.trigger(
    { kind: "model", ...jobData },
    {
      delay: options?.delay ? new Date(Date.now() + options.delay) : undefined,
      maxAttempts: 2,
    },
  );
  return { id: handle.id };
};
