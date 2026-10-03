import { task } from "@trigger.dev/sdk";
import { WavespeedAPI, getWavespeedClient } from "../lib/wavespeed-api";
import { IMAGE_MODELS } from "../config/models";
import prisma from "../lib/db";
import { uploadUrlToStorage } from "../lib/upload";
import { createAsset } from "../lib/asset-utils";
import { STANDARD_RETRY, CANCELLED_ERROR } from "./task-utils";
import { refundConsumption } from "../lib/credits";

export interface ImageGenerationJobData {
  userId: string;
  generationId: string;
  creditsUsed: number;
  /** Credit transaction id to refund on failure. */
  creditTransactionId?: string;
  prompt: string;
  ratio: string;
  resolution: string;
  referenceImageUrls: string[];
  modelKey?: string;
  /** Accepted for API compatibility; WaveSpeed has no NSFW toggle. */
  nsfwChecker?: boolean;
}

export interface ImageGenerationJobResult {
  success: boolean;
  generationId: string;
  outputUrl?: string;
  error?: string;
}

export const imageGenerationTask = task({
  id: "image-generation",
  queue: { concurrencyLimit: 10 },
  retry: { ...STANDARD_RETRY, maxAttempts: 2 },
  run: async (
    payload: ImageGenerationJobData,
  ): Promise<ImageGenerationJobResult> => {
    const {
      userId,
      generationId,
      prompt,
      ratio,
      resolution,
      referenceImageUrls,
      modelKey,
    } = payload;

    // Every image model runs on WaveSpeed; an unknown key is a caller bug.
    if (modelKey && !IMAGE_MODELS[modelKey]) {
      throw new Error(`Unknown image model: ${modelKey}`);
    }
    const client = getWavespeedClient();

    const record = await prisma.imageGeneration.findUnique({
      where: { id: generationId },
    });
    if (!record) throw new Error(`Record not found: ${generationId}`);

    await prisma.imageGeneration.update({
      where: { id: generationId },
      data: { status: "PROCESSING" },
    });

    let taskId = record.taskId;

    if (!taskId) {
      const { model, input } = WavespeedAPI.imageGenerationInput({
        prompt,
        aspectRatio: ratio,
        resolution,
        referenceImages:
          referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
        modelKey,
      });

      taskId = await client.submit(model, input);

      await prisma.imageGeneration.update({
        where: { id: generationId },
        data: { taskId },
      });
    }

    const result = await client.poll(taskId);

    if (result.status === "failed") {
      throw new Error(result.error || "Image generation failed");
    }

    const providerImageUrl = result.outputs[0];
    if (!providerImageUrl) {
      throw new Error("No image URL returned from provider");
    }

    const uploadResult = await uploadUrlToStorage(
      providerImageUrl,
      `generation-${generationId}.png`,
      "image-generations",
    );

    const outputUrl =
      uploadResult.success && uploadResult.fileUrl
        ? uploadResult.fileUrl
        : providerImageUrl;

    const outputAsset = await createAsset({
      userId,
      url: outputUrl,
      name: `Image generation ${generationId}`,
      type: "IMAGE",
      source: "GENERATION",
    });

    await prisma.imageGeneration.update({
      where: { id: generationId },
      data: {
        status: "COMPLETED",
        outputAssetId: outputAsset.id,
        thumbnailAssetId: outputAsset.id,
      },
    });

    // Credit accounting was settled at queue time via consumeCredits().

    return { success: true, generationId, outputUrl };
  },
  // Runs only after all retries are exhausted.
  onFailure: async ({ payload, error }) => {
    const message = error instanceof Error ? error.message : String(error);
    await finalizeGeneration(payload, message, "image.generation.failed");
  },
  // Cancelled runs skip onFailure, so terminal cleanup must happen here too.
  onCancel: async ({ payload }) => {
    await finalizeGeneration(payload, CANCELLED_ERROR, "image.generation.cancelled");
  },
});

// Shared terminal handler for onFailure/onCancel: mark the row and refund once.
async function finalizeGeneration(
  payload: ImageGenerationJobData,
  message: string,
  refundReason: string,
) {
  const { generationId, creditTransactionId } = payload;

  try {
    await prisma.imageGeneration.update({
      where: { id: generationId },
      data: {
        status: "FAILED",
        error: message.split(":")[2]?.trim() || message,
      },
    });

    if (creditTransactionId) {
      await refundConsumption(creditTransactionId, refundReason, {
        generationId,
      });
    }
  } catch (refundError) {
    console.error(
      `[ImageGen ${generationId}] Failed to update DB/refund:`,
      refundError,
    );
  }
}

export const addImageGenerationJob = async (
  jobData: ImageGenerationJobData,
  options?: { priority?: number; delay?: number },
) => {
  const handle = await imageGenerationTask.trigger(jobData, {
    delay: options?.delay ? new Date(Date.now() + options.delay) : undefined,
  });
  return { id: handle.id };
};
