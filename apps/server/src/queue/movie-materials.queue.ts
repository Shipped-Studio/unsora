import { task } from "@trigger.dev/sdk";
import { generateText } from "ai";
import { openrouter } from "../lib/ai-client";
import { WavespeedAPI, getWavespeedClient } from "../lib/wavespeed-api";
import prisma from "../lib/db";
import { uploadUrlToStorage } from "../lib/upload";
import { createAsset } from "../lib/asset-utils";
import { STANDARD_RETRY, CANCELLED_ERROR } from "./task-utils";
import { refundConsumption } from "../lib/credits";
import {
  characterFaceReferencePrompt,
  characterWideBodyReferencePrompt,
  characterSheetPrompt,
  locationReferencePrompt,
  firstFramePrompt,
  styleReferenceCollagePrompt,
  multishotBoard2x4Prompt,
  multishotBoard1x4Prompt,
} from "../../prompts/movie-materials.prompts";

export interface MovieMaterialsJobData {
  userId: string;
  generationId: string;
  creditsUsed: number;
  /** Credit transaction id to refund on failure. */
  creditTransactionId?: string;
  prompt: string;
  mode: string;
  params: Record<string, string>;
  ratio: string;
  resolution: string;
  referenceImageUrls: string[];
}

export interface MovieMaterialsJobResult {
  success: boolean;
  generationId: string;
  outputUrl?: string;
  error?: string;
}

function buildPrompt(
  mode: string,
  description: string,
  aspectRatio: string,
  params: Record<string, string>,
): string {
  const cinematographyStyle = params.cinematography ?? "cinematic";

  switch (mode) {
    case "face":
      return characterFaceReferencePrompt({
        description,
        age: params.age ?? "adult",
        gender: params.gender ?? "female",
        cinematographyStyle,
        aspectRatio,
      });
    case "wide-body":
      return characterWideBodyReferencePrompt({
        description,
        cinematographyStyle,
        aspectRatio,
      });
    case "sheet":
      return characterSheetPrompt({
        description,
        cinematographyStyle,
        aspectRatio,
      });
    case "location":
      return locationReferencePrompt({
        description,
        cinematographyStyle,
        aspectRatio,
      });
    case "first-frame":
      return firstFramePrompt({
        description,
        cinematographyStyle,
        aspectRatio,
        cameraAngle: params["camera-angle"] ?? "eye-level",
      });
    case "style-collage":
      return styleReferenceCollagePrompt({
        description,
        cinematographyStyle,
        aspectRatio,
        colorPalette: params["color-palette"] ?? "warm",
        lightingMood: params["lighting-mood"] ?? "natural",
        eraMediumVibe: params["era-vibe"] ?? "modern",
      });
    case "multishot-2x4":
      return multishotBoard2x4Prompt({
        description,
        cinematographyStyle,
        aspectRatio,
      });
    case "multishot-1x4":
      return multishotBoard1x4Prompt({
        description,
        cinematographyStyle,
        aspectRatio,
      });
    default:
      return description;
  }
}

export const movieMaterialsTask = task({
  id: "movie-materials",
  queue: { concurrencyLimit: 10 },
  retry: { ...STANDARD_RETRY, maxAttempts: 2 },
  run: async (
    payload: MovieMaterialsJobData,
  ): Promise<MovieMaterialsJobResult> => {
    const {
      userId,
      generationId,
      prompt,
      mode,
      params,
      ratio,
      resolution,
      referenceImageUrls,
    } = payload;

    const client = getWavespeedClient();

    const record = await prisma.imageGeneration.findUnique({
      where: { id: generationId },
    });
    if (!record) throw new Error(`Record not found: ${generationId}`);

    await prisma.imageGeneration.update({
      where: { id: generationId },
      data: { status: "PROCESSING" },
    });

    const systemPrompt = buildPrompt(mode, prompt, ratio, params);

    const hasImages = referenceImageUrls.length > 0;

    const { text: refinedText } = await generateText({
      model: openrouter("openai/gpt-5.4"),
      ...(hasImages
        ? {
            messages: [
              {
                role: "user" as const,
                content: [
                  { type: "text" as const, text: systemPrompt },
                  ...referenceImageUrls.map((url) => ({
                    type: "image" as const,
                    image: new URL(url),
                  })),
                ],
              },
            ],
          }
        : { prompt: systemPrompt }),
      providerOptions: {
        openrouter: { reasoning: { effort: "high" } },
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
        aspectRatio: ratio,
        resolution: resolution.toLowerCase(),
        referenceImages:
          referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
      });

      taskId = await client.submit(model, input);

      await prisma.imageGeneration.update({
        where: { id: generationId },
        data: { taskId },
      });
    }

    const result = await client.poll(taskId);

    if (result.status === "failed") {
      throw new Error(result.error || "Movie materials generation failed");
    }

    const providerImageUrl = result.outputs[0];
    if (!providerImageUrl) {
      throw new Error("No image URL returned from provider");
    }

    const uploadResult = await uploadUrlToStorage(
      providerImageUrl,
      `movie-mat-${generationId}.png`,
      "movie-materials",
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
    await finalizeGeneration(payload, message, "movie.materials.failed");
  },
  // Cancelled runs skip onFailure, so terminal cleanup must happen here too.
  onCancel: async ({ payload }) => {
    await finalizeGeneration(payload, CANCELLED_ERROR, "movie.materials.cancelled");
  },
});

// Shared terminal handler for onFailure/onCancel: mark the row and refund once.
async function finalizeGeneration(
  payload: MovieMaterialsJobData,
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
      `[MovieMat ${generationId}] Failed to update DB/refund:`,
      refundError,
    );
  }
}

export const addMovieMaterialsJob = async (
  jobData: MovieMaterialsJobData,
  options?: { priority?: number; delay?: number },
) => {
  const handle = await movieMaterialsTask.trigger(jobData, {
    delay: options?.delay ? new Date(Date.now() + options.delay) : undefined,
  });
  return { id: handle.id };
};
