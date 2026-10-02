import { task } from "@trigger.dev/sdk";
import { WavespeedAPI, getWavespeedClient } from "../lib/wavespeed-api";
import prisma from "../lib/db";
import { uploadUrlToStorage } from "../lib/upload";
import { STANDARD_RETRY, CANCELLED_ERROR } from "./task-utils";
import { createAsset } from "../lib/asset-utils";
import { refundConsumption } from "../lib/credits";

export interface ImageUpscaleJobData {
  userId: string;
  jobId: string;
  creditsUsed: number;
  /** Credit transaction id to refund on failure. */
  creditTransactionId?: string;
  imageUrl: string;
  resolution: string;
}

export interface ImageUpscaleJobResult {
  success: boolean;
  jobId: string;
  outputUrl?: string;
  error?: string;
}

export const imageUpscaleTask = task({
  id: "image-upscale",
  queue: { concurrencyLimit: 10 },
  retry: { ...STANDARD_RETRY, maxAttempts: 2 },
  run: async (payload: ImageUpscaleJobData): Promise<ImageUpscaleJobResult> => {
    const { userId, jobId, imageUrl, resolution } = payload;

    const client = getWavespeedClient();

    const record = await prisma.imageGeneration.findUnique({
      where: { id: jobId },
    });
    if (!record) throw new Error(`Record not found: ${jobId}`);

    await prisma.imageGeneration.update({
      where: { id: jobId },
      data: { status: "PROCESSING" },
    });

    let taskId = record.taskId;

    if (!taskId) {
      const { model, input } = WavespeedAPI.imageUpscaleInput({
        image: imageUrl,
        targetResolution: resolution,
      });

      taskId = await client.submit(model, input);

      await prisma.imageGeneration.update({
        where: { id: jobId },
        data: { taskId },
      });
    }

    const result = await client.poll(taskId);

    if (result.status === "failed") {
      throw new Error(result.error || "Image upscale failed");
    }

    const providerImageUrl = result.outputs[0];
    if (!providerImageUrl) {
      throw new Error("No image URL returned from provider");
    }

    const uploadResult = await uploadUrlToStorage(
      providerImageUrl,
      `upscale-${jobId}.jpg`,
      "image-upscales",
    );

    const outputUrl =
      uploadResult.success && uploadResult.fileUrl
        ? uploadResult.fileUrl
        : providerImageUrl;

    const outputAsset = await createAsset({
      userId,
      url: outputUrl,
      name: `Image upscale ${jobId}`,
      type: "IMAGE",
      source: "PROCESSING",
    });

    await prisma.imageGeneration.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        outputAssetId: outputAsset.id,
        thumbnailAssetId: outputAsset.id,
      },
    });

    // Credit accounting was settled at queue time via consumeCredits().

    return { success: true, jobId, outputUrl };
  },
  // Runs only after all retries are exhausted.
  onFailure: async ({ payload, error }) => {
    const message = error instanceof Error ? error.message : String(error);
    await finalizeUpscale(payload, message, "image.upscale.failed");
  },
  // Cancelled runs skip onFailure, so terminal cleanup must happen here too.
  onCancel: async ({ payload }) => {
    await finalizeUpscale(payload, CANCELLED_ERROR, "image.upscale.cancelled");
  },
});

// Shared terminal handler for onFailure/onCancel: mark the row and refund once.
async function finalizeUpscale(
  payload: ImageUpscaleJobData,
  message: string,
  refundReason: string,
) {
  const { jobId, creditTransactionId } = payload;

  try {
    await prisma.imageGeneration.update({
      where: { id: jobId },
      data: { status: "FAILED", error: message },
    });

    if (creditTransactionId) {
      await refundConsumption(creditTransactionId, refundReason, { jobId });
    }
  } catch (refundError) {
    console.error(
      `[ImageUpscale ${jobId}] Failed to update DB/refund:`,
      refundError,
    );
  }
}

export const addImageUpscaleJob = async (
  jobData: ImageUpscaleJobData,
  options?: { priority?: number; delay?: number },
) => {
  const handle = await imageUpscaleTask.trigger(jobData, {
    delay: options?.delay ? new Date(Date.now() + options.delay) : undefined,
  });
  return { id: handle.id };
};
