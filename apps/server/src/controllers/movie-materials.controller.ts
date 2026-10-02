import { Request, Response } from "express";
import prisma from "../lib/db";
import { addMovieMaterialsJob } from "../queue/movie-materials.queue";
import { gptImage2, movieMaterialsConfig } from "../config/models";
import { createAsset } from "../lib/asset-utils";
import {
  consumeCredits,
  getCreditBalance,
  InsufficientCreditsError,
} from "../lib/credits";

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

export class MovieMaterialsController {
  async create(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const {
        prompt,
        mode,
        params = {},
        ratio = "16:9",
        resolution = "2k",
        referenceImageUrls = [],
      } = req.body;

      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Prompt is required" });
      }

      if (!mode || !movieMaterialsConfig.validModes.includes(mode)) {
        return res.status(400).json({ success: false, error: "Invalid mode" });
      }

      if (!movieMaterialsConfig.validRatios.includes(ratio)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid aspect ratio" });
      }

      if (!movieMaterialsConfig.validResolutions.includes(resolution)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid resolution" });
      }

      if (
        !Array.isArray(referenceImageUrls) ||
        referenceImageUrls.length > movieMaterialsConfig.maxReferenceImages
      ) {
        return res.status(400).json({
          success: false,
          error: `Maximum of ${movieMaterialsConfig.maxReferenceImages} reference images allowed`,
        });
      }

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const creditCost = gptImage2.credits({ resolution });

      const balance = await getCreditBalance(user.id);
      if (balance < creditCost) {
        return res.status(402).json({
          success: false,
          error: `Insufficient credits. Need ${creditCost}, have ${balance}`,
          creditsRemaining: balance,
        });
      }

      const generation = await prisma.imageGeneration.create({
        data: {
          userId: user.id,
          model: gptImage2.dbModel,
          prompt: prompt.trim(),
          ratio,
          resolution,
          type: "MOVIE_MATERIALS",
          mode,
          params,
          creditsUsed: creditCost,
          status: "QUEUED",
        },
      });

      if (referenceImageUrls.length > 0) {
        const refAssets = await Promise.all(
          referenceImageUrls.map((url: string, i: number) =>
            createAsset({ userId: user.id, url, name: `Reference image ${i + 1}`, type: "IMAGE", source: "UPLOAD" })
          )
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
          amount: creditCost,
          reason: "movie.materials",
          metadata: { generationId: generation.id, mode, resolution },
        });
        creditTransactionId = consumption.transactionId;
        creditsRemaining = consumption.balanceAfter;
      } catch (err) {
        await prisma.imageGeneration.delete({ where: { id: generation.id } }).catch(() => {});
        if (err instanceof InsufficientCreditsError) {
          return res.status(402).json({
            success: false,
            error: err.message,
            creditsRemaining: err.available,
          });
        }
        throw err;
      }

      const job = await addMovieMaterialsJob({
        userId: user.id,
        generationId: generation.id,
        creditsUsed: creditCost,
        creditTransactionId,
        prompt: prompt.trim(),
        mode,
        params,
        ratio,
        resolution,
        referenceImageUrls,
      });

      return res.json({
        success: true,
        generation: {
          id: generation.id,
          status: "QUEUED",
        },
        creditsDeducted: creditCost,
        creditsRemaining,
      });
    } catch (error) {
      console.error("Create movie materials generation error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(
        Math.max(parseInt(req.query.limit as string) || 20, 1),
        100,
      );
      const offset = (page - 1) * limit;

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const where = { userId: user.id, type: "MOVIE_MATERIALS" as const };

      const [generations, totalCount] = await Promise.all([
        prisma.imageGeneration.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          include: {
            outputAsset: true,
            thumbnailAsset: true,
            referenceAssets: { include: { asset: true }, orderBy: { order: "asc" } },
          },
        }),
        prisma.imageGeneration.count({ where }),
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
      console.error("Get movie materials error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async refresh(req: Request, res: Response) {
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
        where: {
          id: generationId,
          userId: user.id,
          type: "MOVIE_MATERIALS",
        },
        include: {
          outputAsset: true,
          thumbnailAsset: true,
          referenceAssets: { include: { asset: true }, orderBy: { order: "asc" } },
        },
      });

      if (!generation) {
        return res
          .status(404)
          .json({ success: false, error: "Generation not found" });
      }

      return res.json({ success: true, generation });
    } catch (error) {
      console.error("Refresh movie materials status error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async delete(req: Request, res: Response) {
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
      console.error("Delete movie materials error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
}
