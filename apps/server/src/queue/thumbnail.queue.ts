import { task } from "@trigger.dev/sdk";
import { KieAPI, getKieClient } from "../lib/kie-api";
import prisma from "../lib/db";
import { uploadUrlToStorage } from "../lib/upload";
import { createAsset } from "../lib/asset-utils";
import { STANDARD_RETRY, CANCELLED_ERROR } from "./task-utils";
import { refundConsumption } from "../lib/credits";
import { ideateThumbnailPrompt } from "../../prompts/thumbnail.prompt";
import {
  parseExpression,
  parseThumbnailContext,
  resolveThumbnailContext,
} from "../lib/thumbnail-context";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { openrouter } from "../lib/ai-client";

const thumbnailIdeationSchema = z.object({
  description: z.string(),
  highlights: z.array(z.string()),
  targetAudience: z.string(),
  channelStyle: z.string(),
  primaryThumbnailGoal: z.string(),
  additionalInstructions: z.string(),
});

const CONTEXT_PREVIEW_CHARS = 1000;

function buildThumbnailIdeationPrompt(input: {
  contextType?: "youtube" | "pdf";
  contextContent?: string;
  userPrompt: string;
  expression: string;
  hasTemplateReference: boolean;
  referenceImageCount: number;
}): string {
  const contextSection =
    input.contextType && input.contextContent
      ? [
          `Context type: ${input.contextType}`,
          "",
          "Source content:",
          input.contextContent,
        ].join("\n")
      : "No external context document was provided.";

  return [
    "Analyze the provided inputs and reference images, then fill every schema field for YouTube thumbnail ideation.",
    "",
    contextSection,
    input.userPrompt ? `\nUser thumbnail idea:\n${input.userPrompt}` : "",
    input.expression !== "auto"
      ? `\nDesired subject expression: ${input.expression}`
      : "",
    input.hasTemplateReference
      ? "\nOne reference image is the template — treat it as the composition base to adapt."
      : "",
    input.referenceImageCount > 0
      ? `\n${input.referenceImageCount} reference image(s) attached — describe how each should be used in the thumbnail.`
      : "\nNo reference images attached — propose a thumbnail concept from the available inputs.",
    "",
    "Return:",
    "- description: concise summary of what the video is about",
    "- highlights: 3-8 punchy hook points or key moments",
    "- targetAudience: who should click this thumbnail",
    "- channelStyle: inferred visual tone (colors, energy, niche cues)",
    "- primaryThumbnailGoal: the single click-driving message for the thumbnail",
    "- additionalInstructions: concrete visual/layout direction for the image model",
  ]
    .filter(Boolean)
    .join("\n");
}

export interface ThumbnailGenerationJobData {
  userId: string;
  generationId: string;
  creditsUsed: number;
  creditTransactionId?: string;
  prompt: string;
  ratio: string;
  resolution: string;
  referenceImageUrls: string[];
  modelKey: string;
  rawContext: unknown;
  expression?: string;
  hasTemplateReference?: boolean;
}

export interface ThumbnailGenerationJobResult {
  success: boolean;
  generationId: string;
  outputUrl?: string;
  error?: string;
}

export const thumbnailGenerationTask = task({
  id: "thumbnail-generation",
  queue: { concurrencyLimit: 10 },
  retry: { ...STANDARD_RETRY, maxAttempts: 2 },
  run: async (
    payload: ThumbnailGenerationJobData,
  ): Promise<ThumbnailGenerationJobResult> => {
    const {
      userId,
      generationId,
      ratio,
      resolution,
      referenceImageUrls,
      modelKey,
      rawContext,
      expression: rawExpression = "auto",
      hasTemplateReference = false,
    } = payload;

    const record = await prisma.imageGeneration.findUnique({
      where: { id: generationId },
    });

    if (!record) throw new Error(`Record not found: ${generationId}`);

    const contextSource =
      rawContext ??
      (record.params as { context?: unknown } | null)?.context ??
      null;

    const thumbnailContext = parseThumbnailContext(contextSource);
    const expression = parseExpression(rawExpression);
    const userPrompt = record.prompt?.trim() || "";

    if (!thumbnailContext && !userPrompt && referenceImageUrls.length === 0) {
      throw new Error("Provide a prompt, context, or reference images.");
    }

    const project = thumbnailContext
      ? await resolveThumbnailContext(thumbnailContext)
      : null;

    await prisma.imageGeneration.update({
      where: { id: generationId },
      data: {
        status: "PROCESSING",
        params: {
          ...(typeof record.params === "object" && record.params
            ? record.params
            : {}),
          expression,
          ...(thumbnailContext
            ? {
                contextType: thumbnailContext.type,
                contextUrl: thumbnailContext.url,
              }
            : {}),
          project,
        },
      },
    });

    const buildInfo = await generateObject({
      model: openrouter("openai/gpt-4o-mini"),
      schema: thumbnailIdeationSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildThumbnailIdeationPrompt({
                contextType: thumbnailContext?.type,
                contextContent: project?.description.slice(
                  0,
                  CONTEXT_PREVIEW_CHARS,
                ),
                userPrompt,
                expression,
                hasTemplateReference,
                referenceImageCount: referenceImageUrls.length,
              }),
            },
            ...referenceImageUrls.map((url) => ({
              type: "image" as const,
              image: new URL(url),
            })),
          ],
        },
      ],
    });

    const ideation = buildInfo.object;

    const additionalInstructions = [
      ideation.additionalInstructions,
      expression !== "auto" ? `Subject expression: ${expression}.` : "",
      hasTemplateReference
        ? "Use the template reference image as the composition base."
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const providerPrompt = await generateText({
      model: openrouter("anthropic/claude-opus-4.7", {
        reasoning: { effort: "medium" },
      }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: ideateThumbnailPrompt(
                ideation.description,
                ideation.highlights,
                ideation.targetAudience,
                ideation.channelStyle,
                ideation.primaryThumbnailGoal,
                additionalInstructions,
              ),
            },
            ...referenceImageUrls.map((url) => ({
              type: "image" as const,
              image: new URL(url),
            })),
          ],
        },
      ],
    });

    const client = getKieClient();

    let taskId = record.taskId;

    if (!taskId) {
      const { model, input } = KieAPI.imageGenerationInput({
        prompt: providerPrompt.text.trim(),
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
      throw new Error(result.error || "Thumbnail generation failed");
    }

    const providerImageUrl = result.outputs[0];

    if (!providerImageUrl) {
      throw new Error("No image URL returned from provider");
    }

    const uploadResult = await uploadUrlToStorage(
      providerImageUrl,
      `thumbnail-${generationId}.png`,
      "thumbnail-generator",
    );

    const outputUrl =
      uploadResult.success && uploadResult.fileUrl
        ? uploadResult.fileUrl
        : providerImageUrl;

    const outputAsset = await createAsset({
      userId,
      url: outputUrl,
      name: `Thumbnail ${generationId}`,
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

    return { success: true, generationId, outputUrl };
  },
  // Runs only after all retries are exhausted.
  onFailure: async ({ payload, error }) => {
    const message = error instanceof Error ? error.message : String(error);
    await finalizeGeneration(payload, message, "thumbnail.generation.failed");
  },
  // Cancelled runs skip onFailure, so terminal cleanup must happen here too.
  onCancel: async ({ payload }) => {
    await finalizeGeneration(payload, CANCELLED_ERROR, "thumbnail.generation.cancelled");
  },
});

// Shared terminal handler for onFailure/onCancel: mark the row and refund once.
async function finalizeGeneration(
  payload: ThumbnailGenerationJobData,
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
      `[ThumbnailGen ${generationId}] Failed to update DB/refund:`,
      refundError,
    );
  }
}

export const addThumbnailGenerationJob = async (
  jobData: ThumbnailGenerationJobData,
  options?: { priority?: number; delay?: number },
) => {
  const handle = await thumbnailGenerationTask.trigger(jobData, {
    delay: options?.delay ? new Date(Date.now() + options.delay) : undefined,
  });
  return { id: handle.id };
};
