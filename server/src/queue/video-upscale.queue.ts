import { task, wait } from "@trigger.dev/sdk";
import Replicate from "replicate";
import { WavespeedAPI, getWavespeedClient } from "../lib/wavespeed-api";
import prisma from "../lib/db";
import { uploadVideoToStorage } from "../lib/upload";
import { STANDARD_RETRY, CANCELLED_ERROR } from "./task-utils";
import { createAsset, createVideoAssetWithProbe } from "../lib/asset-utils";
import { refundConsumption } from "../lib/credits";

export type VideoUpscaleModel = "standard" | "ultra-1080p" | "ultra-4k";

export interface VideoUpscaleJobData {
  userId: string;
  jobId: string;
  creditsUsed: number;
  /** Credit transaction id to refund on failure. */
  creditTransactionId?: string;
  videoUrl: string;
  model: VideoUpscaleModel;
}

export interface VideoUpscaleJobResult {
  success: boolean;
  jobId: string;
  outputUrl?: string;
  error?: string;
}

// ── Provider: WaveSpeed (standard) ────────────────────────────────────

async function processWithWavespeed(
  existingTaskId: string | null,
  videoUrl: string,
  saveTaskId: (taskId: string) => Promise<void>,
): Promise<{ outputUrl: string; taskId: string }> {
  const client = getWavespeedClient();
  let taskId = existingTaskId;

  if (!taskId) {
    const { model, input } = WavespeedAPI.videoUpscaleInput(videoUrl, "1080p");
    taskId = await client.submit(model, input);
    await saveTaskId(taskId);
  }

  const result = await client.poll(taskId);

  if (result.status === "failed") {
    throw new Error(result.error || "Video upscale failed (wavespeed)");
  }

  const outputUrl = result.outputs[0];
  if (!outputUrl) throw new Error("No video URL returned from wavespeed");

  return { outputUrl, taskId: result.taskId };
}

// ── Provider: Replicate / Topaz (ultra) ───────────────────────────────

const TOPAZ_MODEL = "topazlabs/video-upscale" as const;
const REPLICATE_POLL_INTERVAL_SECONDS = 5;

function topazResolution(model: VideoUpscaleModel): string {
  return model === "ultra-4k" ? "4k" : "1080p";
}

async function processWithReplicate(
  existingTaskId: string | null,
  videoUrl: string,
  upscaleModel: VideoUpscaleModel,
  saveTaskId: (taskId: string) => Promise<void>,
): Promise<{ outputUrl: string; taskId: string }> {
  const apiKey = process.env.REPLICATE_API_KEY;
  
  if (!apiKey) throw new Error("REPLICATE_API_KEY is not configured");

  const replicate = new Replicate({ auth: apiKey });
  let predictionId = existingTaskId;

  if (!predictionId) {
    const prediction = await replicate.predictions.create({
      model: TOPAZ_MODEL,
      input: {
        video: videoUrl,
        target_fps: 24,
        target_resolution: topazResolution(upscaleModel),
      },
    });

    predictionId = prediction.id;
    await saveTaskId(predictionId);
  }

  while (true) {
    const prediction = await replicate.predictions.get(predictionId);

    if (prediction.status === "succeeded") {
      const outputUrl =
        typeof prediction.output === "string"
          ? prediction.output
          : Array.isArray(prediction.output)
            ? prediction.output[0]
            : null;

      if (!outputUrl || typeof outputUrl !== "string") {
        throw new Error("No video URL returned from replicate");
      }

      return { outputUrl, taskId: predictionId };
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
      const errMsg = prediction.error
        ? String(prediction.error)
        : "Video upscale failed (replicate)";
      throw new Error(errMsg);
    }

    await wait.for({ seconds: REPLICATE_POLL_INTERVAL_SECONDS });
  }
}

// ── Task ──────────────────────────────────────────────────────────────

export const videoUpscaleTask = task({
  id: "video-upscale",
  queue: { concurrencyLimit: 10 },
  retry: { ...STANDARD_RETRY, maxAttempts: 2 },
  run: async (payload: VideoUpscaleJobData): Promise<VideoUpscaleJobResult> => {
    const { userId, jobId, videoUrl, model: upscaleModel } = payload;

    const record = await prisma.processedVideo.findUnique({
      where: { id: jobId },
      include: { processedAsset: true },
    });
    if (!record) throw new Error(`Record not found: ${jobId}`);

    if (record.processedAssetId) {
      return { success: true, jobId, outputUrl: record.processedAsset?.url };
    }

    await prisma.processedVideo.update({
      where: { id: jobId },
      data: { status: "processing", upscaleModel },
    });

    const saveTaskId = async (taskId: string) => {
      await prisma.processedVideo.update({
        where: { id: jobId },
        data: { taskId },
      });
    };

    let outputUrl: string;
    let taskId: string;

    if (upscaleModel === "standard") {
      const result = await processWithWavespeed(
        record.taskId,
        videoUrl,
        saveTaskId,
      );
      outputUrl = result.outputUrl;
      taskId = result.taskId;
    } else {
      const result = await processWithReplicate(
        record.taskId,
        videoUrl,
        upscaleModel,
        saveTaskId,
      );
      outputUrl = result.outputUrl;
      taskId = result.taskId;
    }

    const upload = await uploadVideoToStorage(outputUrl);
    const finalUrl = upload.fileUrl || outputUrl;

    const processedAsset = await createVideoAssetWithProbe({
      userId,
      url: finalUrl,
      name: `Video upscale ${jobId}`,
      source: "PROCESSING",
    });
    await prisma.processedVideo.update({
      where: { id: jobId },
      data: {
        status: "completed",
        processedAssetId: processedAsset.id,
        taskId,
      },
    });

    // Credit accounting was settled at queue time via consumeCredits().

    return { success: true, jobId, outputUrl: finalUrl };
  },
  // Runs only after all retries are exhausted.
  onFailure: async ({ payload, error }) => {
    const message = error instanceof Error ? error.message : String(error);
    await finalizeUpscale(payload, message, "video.upscale.failed");
  },
  // Cancelled runs skip onFailure, so terminal cleanup must happen here too.
  onCancel: async ({ payload }) => {
    await finalizeUpscale(payload, CANCELLED_ERROR, "video.upscale.cancelled");
  },
});

// Shared terminal handler for onFailure/onCancel: mark the row and refund once.
async function finalizeUpscale(
  payload: VideoUpscaleJobData,
  message: string,
  refundReason: string,
) {
  const { jobId, creditTransactionId } = payload;

  try {
    await prisma.processedVideo.update({
      where: { id: jobId },
      data: { status: "failed", error: message },
    });

    if (creditTransactionId) {
      await refundConsumption(creditTransactionId, refundReason, {
        processedVideoId: jobId,
      });
    }
  } catch (refundError) {
    console.error(
      `[VideoUpscale ${jobId}] Failed to update DB/refund:`,
      refundError,
    );
  }
}

export const addVideoUpscaleJob = async (
  jobData: VideoUpscaleJobData,
  options?: { priority?: number; delay?: number },
) => {
  const handle = await videoUpscaleTask.trigger(jobData, {
    delay: options?.delay ? new Date(Date.now() + options.delay) : undefined,
  });
  return { id: handle.id };
};
