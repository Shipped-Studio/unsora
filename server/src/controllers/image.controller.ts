import { Request, Response } from "express";
import prisma from "../lib/db";
import { addImageGenerationJob } from "../queue/image-generation.queue";
import { IMAGE_MODELS } from "../config/models";
import { ImageGenerationType } from "@prisma/client";
import { createAsset } from "../lib/asset-utils";
import {
  consumeCredits,
  getCreditBalance,
  InsufficientCreditsError,
} from "../lib/credits";

// ─── Helpers ───

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

// ─── Image Generation ───

export class ImageController {
  // POST /api/image-generations/create
  async createGeneration(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const {
        prompt,
        model: modelKey = "nano-banana-2",
        ratio = "auto",
        resolution = "2k",
        referenceImageUrl,
        referenceImageUrls,
        nsfwChecker,
      } = req.body;

      const modelConfig = IMAGE_MODELS[modelKey];
      if (!modelConfig) {
        return res.status(400).json({
          success: false,
          error: `Invalid model. Must be one of: ${Object.keys(IMAGE_MODELS).join(", ")}`,
        });
      }

      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Prompt is required" });
      }

      if (modelConfig.aspectRatio && !modelConfig.aspectRatio.includes(ratio)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid aspect ratio" });
      }

      if (!modelConfig.resolution.includes(resolution)) {
        return res.status(400).json({
          success: false,
          error: `Invalid resolution. Must be one of: ${modelConfig.resolution.join(", ")}`,
        });
      }

      let refUrls: string[] = [];
      if (referenceImageUrls && Array.isArray(referenceImageUrls)) {
        refUrls = referenceImageUrls;
      } else if (referenceImageUrl && typeof referenceImageUrl === "string") {
        refUrls = [referenceImageUrl];
      }

      if (
        modelConfig.maxRefs &&
        refUrls.length > modelConfig.maxRefs
      ) {
        return res.status(400).json({
          success: false,
          error: `Maximum of ${modelConfig.maxRefs} reference images allowed`,
        });
      }

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const genCreditCost = modelConfig.credits({ resolution });

      const balance = await getCreditBalance(user.id);
      if (balance < genCreditCost) {
        return res.status(402).json({
          success: false,
          error: `Insufficient credits. Need ${genCreditCost}, have ${balance}`,
          creditsRemaining: balance,
        });
      }

      const generation = await prisma.imageGeneration.create({
        data: {
          userId: user.id,
          model: modelConfig.dbModel,
          prompt: prompt.trim(),
          ratio,
          resolution,
          creditsUsed: genCreditCost,
          status: "QUEUED",
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

      let creditTransactionId: string;
      let creditsRemaining: number;
      try {
        const consumption = await consumeCredits({
          userId: user.id,
          amount: genCreditCost,
          reason: "image.generation",
          metadata: { generationId: generation.id, model: modelConfig.dbModel },
        });
        creditTransactionId = consumption.transactionId;
        creditsRemaining = consumption.balanceAfter;
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          await prisma.imageGeneration
            .delete({ where: { id: generation.id } })
            .catch(() => {});
          return res.status(402).json({
            success: false,
            error: err.message,
            creditsRemaining: err.available,
          });
        }
        throw err;
      }

      const job = await addImageGenerationJob({
        userId: user.id,
        generationId: generation.id,
        creditsUsed: genCreditCost,
        creditTransactionId,
        prompt: prompt.trim(),
        ratio,
        resolution,
        referenceImageUrls: refUrls,
        modelKey: modelConfig.key,
        nsfwChecker: typeof nsfwChecker === "boolean" ? nsfwChecker : undefined,
      });

      return res.json({
        success: true,
        generation: {
          id: generation.id,
          status: "QUEUED",
        },
        creditsDeducted: genCreditCost,
        creditsRemaining,
      });
    } catch (error) {
      console.error("Create image generation error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  // GET /api/image-generations/all
  async getGenerations(req: Request, res: Response) {
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
  }

  // GET /api/image-generations/refresh/:generationId
  async refreshGenerationStatus(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;
      const { generationId } = req.params;

      if (!generationId) {
        return res
          .status(400)
          .json({ success: false, error: "Generation ID is required" });
      }

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const generation = await prisma.imageGeneration.findFirst({
        where: { id: generationId, userId: user.id },
        include: {
          outputAsset: true,
          thumbnailAsset: true,
          referenceAssets: {
            include: { asset: true },
            orderBy: { order: "asc" },
          },
        },
      });

      if (!generation) {
        return res
          .status(404)
          .json({ success: false, error: "Generation not found" });
      }

      return res.json({ success: true, generation });
    } catch (error) {
      console.error("Refresh image generation status error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  // DELETE /api/image-generations/:generationId
  async deleteGeneration(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;
      const { generationId } = req.params;

      if (!generationId) {
        return res
          .status(400)
          .json({ success: false, error: "Generation ID is required" });
      }

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      await prisma.imageGeneration.delete({
        where: { id: generationId, userId: user.id },
      });

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
  }
}
