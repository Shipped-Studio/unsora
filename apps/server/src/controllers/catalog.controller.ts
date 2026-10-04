import { Request, Response } from "express";
import { Prisma, VideoGenerationType } from "@prisma/client";
import prisma from "../lib/db";
import type { CatalogCategory } from "../config/catalog";
import {
  CatalogInputError,
  getCatalog,
  isOwnMediaUrl,
  mediaUrls,
  resolveRequest,
  type ResolvedRequest,
} from "../lib/wavespeed-catalog";
import { importUrlToLibrary } from "../lib/remote-media";
import { ImportError } from "../lib/remote-import";
import {
  getApiKeyId,
  mergeApiContext,
  replayIdempotentResponse,
  saveIdempotentResponse,
} from "../lib/api-public";
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

export interface CatalogBody {
  model: string;
  category?: CatalogCategory;
  mode?: string;
  inputs: Record<string, unknown>;
  expectedCredits?: number;
}

export interface CatalogResult {
  status: number;
  body: Record<string, unknown>;
}

function readBody(req: Request): CatalogBody {
  const { model, mode, inputs, expectedCredits, category } = req.body ?? {};
  if (typeof model !== "string" || !model) {
    throw new CatalogInputError("model is required");
  }
  if (inputs !== undefined && (typeof inputs !== "object" || Array.isArray(inputs))) {
    throw new CatalogInputError("inputs must be an object");
  }
  if (category !== undefined && !CATEGORIES.includes(category)) {
    throw new CatalogInputError(
      `category must be one of: ${CATEGORIES.join(", ")}`,
    );
  }
  return {
    model,
    category: category as CatalogCategory | undefined,
    mode: typeof mode === "string" ? mode : undefined,
    inputs: (inputs ?? {}) as Record<string, unknown>,
    expectedCredits:
      typeof expectedCredits === "number" && expectedCredits > 0
        ? expectedCredits
        : undefined,
  };
}

/** Reject a model from another category (an image model sent to create_video). */
function assertCategory(r: ResolvedRequest, category?: CatalogCategory) {
  if (category && r.model.category !== category) {
    throw new CatalogInputError(
      `${r.model.label} is a ${r.model.category} model, not a ${category} model`,
    );
  }
}

export function sendCatalogError(res: Response, error: unknown, context: string) {
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

/** Most outside files one generation will import. */
const MAX_IMPORTS = 12;

/**
 * Copy media hosted elsewhere into the user's library and point the inputs at
 * our copies. API and MCP callers can then pass any public URL, while prices
 * and jobs only ever read files we control.
 */
async function importExternalMedia(
  userId: string,
  inputs: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const external = [...new Set(mediaUrls(inputs).filter((u) => !isOwnMediaUrl(u)))];
  if (!external.length) return inputs;
  if (external.length > MAX_IMPORTS) {
    throw new CatalogInputError(
      `Too many outside files (${external.length}). Upload them first, or use at most ${MAX_IMPORTS}.`,
    );
  }

  const hosted = new Map<string, string>();
  try {
    await Promise.all(
      external.map(async (url) => {
        hosted.set(url, await importUrlToLibrary(userId, url));
      }),
    );
  } catch (err) {
    if (err instanceof ImportError) {
      throw new CatalogInputError(`Couldn't import a media file: ${err.message}`);
    }
    throw err;
  }

  const swap = (v: unknown) =>
    typeof v === "string" ? (hosted.get(v) ?? v) : v;
  return Object.fromEntries(
    Object.entries(inputs).map(([k, v]) => [
      k,
      Array.isArray(v) ? v.map(swap) : swap(v),
    ]),
  );
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

/**
 * Validate, price, charge and queue one catalog generation. Shared by
 * `/catalog/generate` and the legacy public create endpoints, which translate
 * their old request shapes into a CatalogBody first.
 */
export async function startCatalogGeneration(
  req: Request,
  body: CatalogBody,
): Promise<CatalogResult> {
  const user = await prisma.user.findUnique({
    where: { clerkId: req.auth.userId },
    select: { id: true },
  });
  if (!user) {
    return { status: 404, body: { success: false, error: "User not found" } };
  }

  const resolved = await resolveRequest({
    modelKey: body.model,
    modeKey: body.mode,
    inputs: await importExternalMedia(user.id, body.inputs),
    strict: true,
  });
  assertCategory(resolved, body.category);
  const quote = await quoteGeneration(resolved.modelId, resolved.inputs);

  // Never charge more than the price the user was shown.
  if (body.expectedCredits !== undefined && quote.credits > body.expectedCredits) {
    return {
      status: 409,
      body: {
        success: false,
        code: "PRICE_CHANGED",
        error: `The price changed to ${quote.credits} credits. Generate again to confirm.`,
        credits: quote.credits,
      },
    };
  }

  const { inputs, model, mode, modelId } = resolved;
  const prompt = typeof inputs.prompt === "string" ? inputs.prompt : "";
  const isImage = model.category === "image";
  const { margin, creditUsd } = pricingConfig();

  // The row stores what was submitted; our cost lives only on the credit
  // transaction, which users never see.
  const apiKeyId = getApiKeyId(req);
  const settings = mergeApiContext(
    {
      source: "catalog",
      mode: mode.key,
      modelId,
      inputs: inputs as Prisma.InputJsonObject,
    },
    { apiKeyId },
  );

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
      apiKeyId,
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
      return {
        status: 402,
        body: {
          success: false,
          error: err.message,
          creditsRemaining: err.available,
        },
      };
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
    return {
      status: 503,
      body: {
        success: false,
        error: "Couldn't start the generation. Your credits were not charged. Try again.",
      },
    };
  }

  const response = {
    success: true,
    // Top-level `model` keeps the legacy create responses' shape.
    model: model.key,
    generation: {
      id: generation.id,
      status: "QUEUED",
      model: model.key,
      mode: mode.key,
      modelId,
    },
    creditsDeducted: quote.credits,
    creditsRemaining: consumption.balanceAfter,
  };
  return { status: 200, body: response };}

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
        allowExternalMedia: true,
      });
      assertCategory(resolved, body.category);
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
        mode: resolved.mode.key,
        modelId: resolved.modelId,
        // Media that still has to be attached can change the final price.
        estimate,
      });
    } catch (error) {
      return sendCatalogError(res, error, "quote");
    }
  }

  // POST /api/catalog/generate  { model, mode, inputs, expectedCredits? }
  async generate(req: Request, res: Response) {
    try {
      // Public API: a retried request with the same Idempotency-Key replays
      // the first response instead of charging twice.
      if (await replayIdempotentResponse(req, res)) return;

      const body = readBody(req);
      const result = await startCatalogGeneration(req, body);
      if (result.status === 200) {
        await saveIdempotentResponse(req, 200, result.body);
      }
      return res.status(result.status).json(result.body);
    } catch (error) {
      return sendCatalogError(res, error, "generate");
    }
  }
}
