import { Request, Response } from "express";
import prisma from "../../../lib/db";
import { addImageGenerationJob } from "../../../queue/image-generation.queue";
import { IMAGE_MODELS } from "../../../config/models";
import { ImageGenerationType } from "@prisma/client";
import { createAsset } from "../../../lib/asset-utils";
import {
  consumeCredits,
  getCreditBalance,
  InsufficientCreditsError,
  refundConsumption,
} from "../../../lib/credits";
import { getApiKeyId, mergeApiContext } from "../../../lib/api-public";
import { withPublicCreate } from "../helpers/public-create";
import { handlePublicError } from "../helpers/public-response";

const imageGenerationInclude = {
  outputAsset: true,
  thumbnailAsset: true,
  referenceAssets: {
    include: { asset: true },
    orderBy: { order: "asc" as const },
  },
};

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

type CreateResult =
  | { ok: false; status: number; body: Record<string, unknown> }
  | { ok: true; body: Record<string, unknown> };

export class PublicImageController {
  createGeneration = async (req: Request, res: Response) => {
    try {
      await withPublicCreate(req, res, 200, async () => {
        const result = await this.runCreate(req);
        if (!result.ok) {
          res.status(result.status).json(result.body);
          return null;
        }
        return result.body;
      });
    } catch (error) {
      console.error("Public create image generation error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Internal server error",
        });
      }
    }
  };

  getGenerations = async (req: Request, res: Response) => {
    try {
      const clerkUserId = req.auth.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(
        Math.max(parseInt(req.query.limit as string) || 12, 1),
        100,
      );
      const offset = (page - 1) * limit;

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const [generations, totalCount] = await Promise.all([
        prisma.imageGeneration.findMany({
          where: { userId: user.id, type: ImageGenerationType.BASIC },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          include: {
            outputAsset: true,
            thumbnailAsset: true,
            referenceAssets: {
              include: { asset: true },
              orderBy: { order: "asc" },
            },
          },
        }),
        prisma.imageGeneration.count({
          where: { userId: user.id, type: ImageGenerationType.BASIC },
        }),
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return res.json({
        success: true,
        generations,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
    } catch (error) {
      console.error("Get image generations error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  };

  getGeneration = async (req: Request, res: Response) => {
    try {
      const { generationId } = req.params;
      if (!generationId) {
        return res
          .status(400)
          .json({ success: false, error: "Generation ID is required" });
      }

      const user = await resolveUser(req.auth.userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const generation = await prisma.imageGeneration.findFirst({
        where: {
          id: generationId,
          userId: user.id,
          type: ImageGenerationType.BASIC,
        },
        include: imageGenerationInclude,
      });

      if (!generation) {
        return res
          .status(404)
          .json({ success: false, error: "Generation not found" });
      }

      return res.json({ success: true, generation });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Public get image generation error:",
        "Failed to fetch image generation",
      );
    }
  };

  deleteGeneration = async (req: Request, res: Response) => {
    try {
      const { generationId } = req.params;
      if (!generationId) {
        return res
          .status(400)
          .json({ success: false, error: "Generation ID is required" });
      }

      const user = await resolveUser(req.auth.userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const deleted = await prisma.imageGeneration.deleteMany({
        where: {
          id: generationId,
          userId: user.id,
          type: ImageGenerationType.BASIC,
        },
      });

      if (deleted.count === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Generation not found" });
      }

      return res.json({
        success: true,
        message: "Generation deleted successfully",
      });
    } catch (error) {
      console.error("Delete image generation error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  };

  private async runCreate(req: Request): Promise<CreateResult> {
    const clerkUserId = req.auth.userId;
    const apiKeyId = getApiKeyId(req);
    const {
      prompt,
      model: modelKey = "nano-banana-2",
      resolution = "2k",
      nsfwChecker,
    } = req.body;

    // nuvedaai-style form inputs; legacy names kept as silent aliases.
    const ratio =
      req.body.aspectRatio ?? req.body.aspect ?? req.body.ratio ?? "auto";
    const referenceImages =
      req.body.referenceImages ??
      req.body.referenceImageUrls ??
      (typeof req.body.referenceImageUrl === "string"
        ? [req.body.referenceImageUrl]
        : undefined);

    const modelConfig = IMAGE_MODELS[modelKey];
    if (!modelConfig) {
      return {
        ok: false,
        status: 400,
        body: {
          success: false,
          error: `Invalid model. Must be one of: ${Object.keys(IMAGE_MODELS).join(", ")}`,
        },
      };
    }

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: "Prompt is required" },
      };
    }

    if (
      modelConfig.aspectRatio &&
      !modelConfig.aspectRatio.includes(ratio)
    ) {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: "Invalid aspect ratio" },
      };
    }

    if (!modelConfig.resolution.includes(resolution)) {
      return {
        ok: false,
        status: 400,
        body: {
          success: false,
          error: `Invalid resolution. Must be one of: ${modelConfig.resolution.join(", ")}`,
        },
      };
    }

    let refUrls: string[] = [];
    if (referenceImages && Array.isArray(referenceImages)) {
      refUrls = referenceImages.filter(
        (u: unknown): u is string => typeof u === "string",
      );
    }

    if (
      modelConfig.maxRefs &&
      refUrls.length > modelConfig.maxRefs
    ) {
      return {
        ok: false,
        status: 400,
        body: {
          success: false,
          error: `Maximum of ${modelConfig.maxRefs} reference images allowed`,
        },
      };
    }

    const user = await resolveUser(clerkUserId);
    if (!user) {
      return {
        ok: false,
        status: 404,
        body: { success: false, error: "User not found" },
      };
    }

    const genCreditCost = modelConfig.credits({ resolution });
    const balance = await getCreditBalance(user.id);
    if (balance < genCreditCost) {
      return {
        ok: false,
        status: 402,
        body: {
          success: false,
          error: `Insufficient credits. Need ${genCreditCost}, have ${balance}`,
          creditsRemaining: balance,
        },
      };
    }

    const params = mergeApiContext(null, { apiKeyId });

    const generation = await prisma.imageGeneration.create({
      data: {
        userId: user.id,
        model: modelConfig.dbModel,
        prompt: prompt.trim(),
        ratio,
        resolution,
        creditsUsed: genCreditCost,
        status: "QUEUED",
        params,
      },
    });

    if (refUrls.length > 0) {
      const refAssets = await Promise.all(
        refUrls.map((url: string, i: number) =>
          createAsset({
            userId: user.id,
            url,
            name: `Reference image ${i + 1}`,
            type: "IMAGE",
            source: "UPLOAD",
          }),
        ),
      );
      await prisma.imageGenerationRefAsset.createMany({
        data: refAssets.map((a, i) => ({
          imageGenerationId: generation.id,
          assetId: a.id,
          order: i,
        })),
      });
    }

    // Set once credits are taken, so a failed enqueue can hand them back.
    let consumedTxnId: string | undefined;
    try {
      const consumption = await consumeCredits({
        userId: user.id,
        amount: genCreditCost,
        reason: "image.generation",
        apiKeyId,
        metadata: { generationId: generation.id, model: modelConfig.dbModel },
      });
      consumedTxnId = consumption.transactionId;

      await addImageGenerationJob({
        userId: user.id,
        generationId: generation.id,
        creditsUsed: genCreditCost,
        creditTransactionId: consumption.transactionId,
        prompt: prompt.trim(),
        ratio,
        resolution,
        referenceImageUrls: refUrls,
        modelKey: modelConfig.key,
        nsfwChecker: typeof nsfwChecker === "boolean" ? nsfwChecker : undefined,
      });

      return {
        ok: true,
        body: {
          success: true,
          generation: { id: generation.id, status: "QUEUED" },
          creditsDeducted: genCreditCost,
          creditsRemaining: consumption.balanceAfter,
        },
      };
    } catch (err) {
      if (consumedTxnId) {
        await refundConsumption(consumedTxnId, "image.generation.enqueue_failed", {
          generationId: generation.id,
        }).catch((refundError) =>
          console.error(
            `[v1] Refund after failed enqueue for ${generation.id} failed:`,
            refundError,
          ),
        );
      }
      await prisma.imageGeneration
        .delete({ where: { id: generation.id } })
        .catch(() => {});
      if (err instanceof InsufficientCreditsError) {
        return {
          ok: false,
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
  }
}
