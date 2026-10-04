import { Request, Response } from "express";
import { Prisma, VideoGenerationType } from "@prisma/client";
import prisma from "../lib/db";
import type { CatalogCategory } from "../config/catalog";
import {
  CatalogInputError,
  getCatalog,
  resolveRequest,
  type ResolvedRequest,
} from "../lib/wavespeed-catalog";
import {
  PricingError,
  pricingConfig,
  quoteGeneration,
} from "../lib/generation-pricing";
import {
  consumeCredits,
  InsufficientCreditsError,
  refundConsumption,
} from "../lib/credits";
import { addWavespeedCatalogJob } from "../queue/video-generation.queue";
import { addImageGenerationJob } from "../queue/image-generation.queue";

const CATEGORIES: CatalogCategory[] = ["video", "image", "motion-control"];

function readBody(req: Request) {
  const { model, mode, inputs, expectedCredits } = req.body ?? {};
  if (typeof model !== "string" || !model) {
    throw new CatalogInputError("model is required");
  }
  if (inputs !== undefined && (typeof inputs !== "object" || Array.isArray(inputs))) {
    throw new CatalogInputError("inputs must be an object");
  }
  return {
    model,
    mode: typeof mode === "string" ? mode : undefined,
    inputs: (inputs ?? {}) as Record<string, unknown>,
    expectedCredits:
      typeof expectedCredits === "number" && expectedCredits > 0
        ? expectedCredits
        : undefined,
  };
}

function sendError(res: Response, error: unknown, context: string) {
  if (error instanceof CatalogInputError) {
    return res.status(400).json({ success: false, error: error.message });
  }
  if (error instanceof PricingError) {
    return res.status(error.status).json({ success: false, error: error.message });
  }
  console.error(`[catalog] ${context}:`, error);
  return res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : "Internal server error",
  });
}

function videoFunctionMode(r: ResolvedRequest): VideoGenerationType {
  if (r.model.category === "motion-control") {
    return VideoGenerationType.MOTION_CONTROL;
  }
  const { inputs, modelId } = r;
  if (modelId.includes("reference-to-video")) {
    return VideoGenerationType.OMNI_REFERENCE;
  }
  if (inputs.last_image || inputs.end_image) {
    return VideoGenerationType.FIRST_LAST_FRAMES;
  }
  if (inputs.image) return VideoGenerationType.IMAGE_TO_VIDEO;
  if (
    inputs.reference_images ||
    inputs.reference_videos ||
    inputs.reference_audios
  ) {
    return VideoGenerationType.OMNI_REFERENCE;
  }
  return VideoGenerationType.TEXT_TO_VIDEO;
}

/** "1280*720" → "16:9"; ratios pass through. */
function ratioOf(inputs: Record<string, unknown>): string {
  if (typeof inputs.aspect_ratio === "string") return inputs.aspect_ratio;
  if (typeof inputs.size === "string") {
    const [w, h] = inputs.size.split("*").map(Number);
    if (w && h) {
      const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
      const d = gcd(w, h);
      return `${w / d}:${h / d}`;
    }
  }
  return "auto";
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export class CatalogController {
  // GET /api/catalog?category=video|image|motion-control
  async list(req: Request, res: Response) {
    try {
      const category = req.query.category as CatalogCategory | undefined;
      if (category && !CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          error: `category must be one of: ${CATEGORIES.join(", ")}`,
        });
      }
      const models = await getCatalog(category);
      return res.json({ success: true, models });
    } catch (error) {
      console.error("[catalog] list:", error);
      return res.status(503).json({
        success: false,
        error: "Models are unavailable right now. Try again in a minute.",
      });
    }
  }

  // POST /api/catalog/quote  { model, mode, inputs }
  async quote(req: Request, res: Response) {
    try {
      const body = readBody(req);
      const resolved = await resolveRequest({
        modelKey: body.model,
        modeKey: body.mode,
        inputs: body.inputs,
        strict: false,
      });
      const estimate = resolved.missingMedia.length > 0;
      let credits: number | null;
      try {
        credits = (await quoteGeneration(resolved.modelId, resolved.inputs))
          .credits;
      } catch (err) {
        // Some models can't be priced until their required files are attached.
        if (!(err instanceof PricingError) || !estimate) throw err;
        credits = null;
      }
      return res.json({
        success: true,
        credits,
        modelId: resolved.modelId,
        // Media that still has to be attached can change the final price.
        estimate,
      });
    } catch (error) {
      return sendError(res, error, "quote");
    }
  }

  // POST /api/catalog/generate  { model, mode, inputs, expectedCredits? }
  async generate(req: Request, res: Response) {
    try {
      const body = readBody(req);
      const user = await prisma.user.findUnique({
        where: { clerkId: req.auth.userId },
        select: { id: true },
      });
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const resolved = await resolveRequest({
        modelKey: body.model,
        modeKey: body.mode,
        inputs: body.inputs,
        strict: true,
      });
      const quote = await quoteGeneration(resolved.modelId, resolved.inputs);

      // Never charge more than the price the user was shown.
      if (body.expectedCredits !== undefined && quote.credits > body.expectedCredits) {
        return res.status(409).json({
          success: false,
          code: "PRICE_CHANGED",
          error: `The price changed to ${quote.credits} credits. Generate again to confirm.`,
          credits: quote.credits,
        });
      }

      const { inputs, model, mode, modelId } = resolved;
      const prompt = typeof inputs.prompt === "string" ? inputs.prompt : "";
      const isImage = model.category === "image";
      const { margin, creditUsd } = pricingConfig();

      // The row stores what was submitted; our cost lives only on the credit
      // transaction, which users never see.
      const settings: Prisma.InputJsonObject = {
        source: "catalog",
        mode: mode.key,
        modelId,
        inputs: inputs as Prisma.InputJsonObject,
      };

      const generation = isImage
        ? await prisma.imageGeneration.create({
            data: {
              userId: user.id,
              model: model.key,
              prompt,
              ratio: ratioOf(inputs),
              resolution: stringOrNull(inputs.resolution) ?? "auto",
              mode: mode.key,
              params: settings,
              creditsUsed: quote.credits,
              status: "QUEUED",
            },
          })
        : await prisma.generation.create({
            data: {
              userId: user.id,
              model: model.key,
              prompt,
              negativePrompt: stringOrNull(inputs.negative_prompt),
              functionMode: videoFunctionMode(resolved),
              ratio: ratioOf(inputs),
              duration: Math.round(Number(inputs.duration) || 0),
              resolution: stringOrNull(inputs.resolution),
              sound: Boolean(
                inputs.generate_audio ?? inputs.sound ?? inputs.keep_original_sound,
              ),
              characterOrientation: stringOrNull(inputs.character_orientation),
              metadata: settings,
              creditsUsed: quote.credits,
              status: "QUEUED",
            },
          });

      const deleteRow = () =>
        (isImage
          ? prisma.imageGeneration.delete({ where: { id: generation.id } })
          : prisma.generation.delete({ where: { id: generation.id } })
        ).catch(() => {});

      let consumption;
      try {
        consumption = await consumeCredits({
          userId: user.id,
          amount: quote.credits,
          reason: isImage
            ? "image.generation"
            : model.category === "motion-control"
              ? "video.generation.motion-control"
              : "video.generation",
          metadata: {
            generationId: generation.id,
            model: model.key,
            modelId,
            costUsd: quote.costUsd,
            listUsd: quote.listUsd,
            margin,
            creditUsd,
          },
        });
      } catch (err) {
        await deleteRow();
        if (err instanceof InsufficientCreditsError) {
          return res.status(402).json({
            success: false,
            error: err.message,
            creditsRemaining: err.available,
          });
        }
        throw err;
      }

      const job = {
        userId: user.id,
        generationId: generation.id,
        creditsUsed: quote.credits,
        creditTransactionId: consumption.transactionId,
      };

      try {
        if (isImage) {
          await addImageGenerationJob({
            ...job,
            prompt,
            ratio: ratioOf(inputs),
            resolution: stringOrNull(inputs.resolution) ?? "auto",
            referenceImageUrls: [],
            modelKey: model.key,
            wavespeed: { modelId, inputs },
          });
        } else {
          await addWavespeedCatalogJob({ ...job, modelId, inputs });
        }
      } catch (err) {
        // The job never started: give the credits back now rather than
        // leaving it to the stuck-jobs sweeper hours later.
        console.error("[catalog] enqueue failed:", err);
        await refundConsumption(
          consumption.transactionId,
          isImage ? "image.generation.enqueue_failed" : "video.generation.enqueue_failed",
          { generationId: generation.id },
        ).catch((refundErr) =>
          console.error("[catalog] refund after enqueue failure:", refundErr),
        );
        await deleteRow();
        return res.status(503).json({
          success: false,
          error: "Couldn't start the generation. Your credits were not charged. Try again.",
        });
      }

      return res.json({
        success: true,
        generation: { id: generation.id, status: "QUEUED", model: model.key },
        creditsDeducted: quote.credits,
        creditsRemaining: consumption.balanceAfter,
      });
    } catch (error) {
      return sendError(res, error, "generate");
    }
  }
}
