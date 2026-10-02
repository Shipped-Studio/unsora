import { task } from "@trigger.dev/sdk";
import { generateText } from "ai";
import { openrouter } from "../lib/ai-client";
import { WavespeedAPI, getWavespeedClient } from "../lib/wavespeed-api";
import prisma from "../lib/db";
import { uploadUrlToStorage } from "../lib/upload";
import { createAsset } from "../lib/asset-utils";
import { STANDARD_RETRY, CANCELLED_ERROR } from "./task-utils";
import { influencerStudioPrompt } from "../../prompts/influencer-studio.prompt";
import { refundConsumption } from "../lib/credits";

export interface InfluencerStudioJobData {
  userId: string;
  generationId: string;
  creditsUsed: number;
  /** Credit transaction id to refund on failure. */
  creditTransactionId?: string;
  prompt: string;
  aspectRatio: string;
  cameraAngle?: string;
  styleMode?: string;
  age?: number;
}

export interface InfluencerStudioJobResult {
  success: boolean;
  generationId: string;
  outputUrl?: string;
  error?: string;
}

export const influencerStudioTask = task({
  id: "influencer-studio",
  queue: { concurrencyLimit: 10 },
  retry: { ...STANDARD_RETRY, maxAttempts: 2 },
  run: async (
    payload: InfluencerStudioJobData,
  ): Promise<InfluencerStudioJobResult> => {
    const { userId, generationId, prompt, aspectRatio } = payload;

    const client = getWavespeedClient();

    const record = await prisma.imageGeneration.findUnique({
      where: { id: generationId },
    });
    if (!record) throw new Error(`Record not found: ${generationId}`);

    await prisma.imageGeneration.update({
      where: { id: generationId },
      data: { status: "PROCESSING" },
    });

    const systemPrompt = influencerStudioPrompt(
      prompt,
      aspectRatio,
      payload.cameraAngle,
      payload.styleMode,
      payload.age,
    );

    const { text: refinedText } = await generateText({
      model: openrouter("google/gemini-3.1-pro-preview"),
      prompt: systemPrompt,
      providerOptions: {
        openrouter: { reasoning: { effort: "medium" } },
      },
    });

    const finalPrompt = refinedText.trim();

    if (!finalPrompt) {
      throw new Error("AI returned an empty prompt");
    }

    let taskId = record.taskId;

    if (!taskId) {
      const { model, input } = WavespeedAPI.gptImage2Input({
        prompt: finalPrompt,
        aspectRatio,
        resolution: "2k",
      });

      taskId = await client.submit(model, input);

      await prisma.imageGeneration.update({
        where: { id: generationId },
        data: { taskId },
      });
    }

    const result = await client.poll(taskId);

    if (result.status === "failed") {
      throw new Error(result.error || "Influencer image generation failed");
    }

    const providerImageUrl = result.outputs[0];
    if (!providerImageUrl) {
      throw new Error("No image URL returned from provider");
    }

    const uploadResult = await uploadUrlToStorage(
      providerImageUrl,
      `influencer-${generationId}.png`,
      "influencer-studio",
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
    await finalizeGeneration(payload, message, "influencer.studio.failed");
  },
  // Cancelled runs skip onFailure, so terminal cleanup must happen here too.
  onCancel: async ({ payload }) => {
    await finalizeGeneration(payload, CANCELLED_ERROR, "influencer.studio.cancelled");
  },
});

// Shared terminal handler for onFailure/onCancel: mark the row and refund once.
async function finalizeGeneration(
  payload: InfluencerStudioJobData,
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
      `[Influencer ${generationId}] Failed to update DB/refund:`,
      refundError,
    );
  }
}

export const addInfluencerStudioJob = async (
  jobData: InfluencerStudioJobData,
  options?: { priority?: number; delay?: number },
) => {
  const handle = await influencerStudioTask.trigger(jobData, {
    delay: options?.delay ? new Date(Date.now() + options.delay) : undefined,
  });
  return { id: handle.id };
};
