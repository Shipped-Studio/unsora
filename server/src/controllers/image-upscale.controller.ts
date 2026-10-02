import { Request, Response } from "express";
import prisma from "../lib/db";
import { addImageUpscaleJob } from "../queue/image-upscale.queue";
import { imageUpscaleConfig } from "../config/models";
import { ImageGenerationType } from "@prisma/client";
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

export class ImageUpscaleController {
  // POST /api/image-upscaler/create
  async createUpscale(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const { imageUrl, resolution = "2k" } = req.body;

      if (!imageUrl || typeof imageUrl !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "imageUrl is required" });
      }

      if (!imageUpscaleConfig.validResolutions.includes(resolution)) {
        return res.status(400).json({
          success: false,
          error: `Invalid resolution. Must be one of: ${imageUpscaleConfig.validResolutions.join(", ")}`,
        });
      }

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const upscaleCreditCost =
        imageUpscaleConfig.credits[resolution] ??
        imageUpscaleConfig.credits["4k"];

      const balance = await getCreditBalance(user.id);
      if (balance < upscaleCreditCost) {
        return res.status(402).json({
          success: false,
          error: `Insufficient credits. Need ${upscaleCreditCost}, have ${balance}`,
          creditsRemaining: balance,
        });
      }

      const inputAsset = await createAsset({
        userId: user.id,
        url: imageUrl,
        name: "Image upscale input",
        type: "IMAGE",
        source: "UPLOAD",
      });

      const job = await prisma.imageGeneration.create({
        data: {
          userId: user.id,
          type: "UPSCALE",
          prompt: "",
          inputAssetId: inputAsset.id,
          creditsUsed: upscaleCreditCost,
          status: "QUEUED",
        },
      });

      let creditTransactionId: string;
      let creditsRemaining: number;
      try {
        const consumption = await consumeCredits({
          userId: user.id,
          amount: upscaleCreditCost,
          reason: "image.upscale",
          metadata: { jobId: job.id, resolution },
        });
        creditTransactionId = consumption.transactionId;
        creditsRemaining = consumption.balanceAfter;
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          await prisma.imageGeneration.delete({ where: { id: job.id } }).catch(() => {});
          return res.status(402).json({
            success: false,
            error: err.message,
            creditsRemaining: err.available,
          });
        }
        throw err;
      }

      const queueJob = await addImageUpscaleJob({
        userId: user.id,
        jobId: job.id,
        creditsUsed: upscaleCreditCost,
        creditTransactionId,
        imageUrl,
        resolution,
      });

      return res.json({
        success: true,
        job: {
          id: job.id,
          status: "QUEUED",
        },
        creditsDeducted: upscaleCreditCost,
        creditsRemaining,
      });
    } catch (error) {
      console.error("Create image upscale error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  // GET /api/image-upscaler/all
  async getUpscales(req: Request, res: Response) {
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

      const [upscales, totalCount] = await Promise.all([
        prisma.imageGeneration.findMany({
          where: { userId: user.id, type: ImageGenerationType.UPSCALE },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          include: {
            inputAsset: true,
            outputAsset: true,
            thumbnailAsset: true,
          },
        }),
        prisma.imageGeneration.count({
          where: { userId: user.id, type: ImageGenerationType.UPSCALE },
        }),
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return res.json({
        success: true,
        jobs: upscales,
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
      console.error("Get image upscales error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  // GET /api/image-upscaler/refresh/:jobId
  async refreshUpscaleStatus(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;
      const { jobId } = req.params;

      if (!jobId) {
        return res
          .status(400)
          .json({ success: false, error: "Job ID is required" });
      }

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const job = await prisma.imageGeneration.findFirst({
        where: { id: jobId, userId: user.id, type: ImageGenerationType.UPSCALE },
        include: {
          inputAsset: true,
          outputAsset: true,
          thumbnailAsset: true,
        },
      });

      if (!job) {
        return res
          .status(404)
          .json({ success: false, error: "Upscale job not found" });
      }

      return res.json({ success: true, job });
    } catch (error) {
      console.error("Refresh image upscale status error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  // DELETE /api/image-upscaler/:jobId
  async deleteUpscale(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;
      const { jobId } = req.params;

      if (!jobId) {
        return res
          .status(400)
          .json({ success: false, error: "Job ID is required" });
      }

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      await prisma.imageGeneration.delete({
        where: { id: jobId, userId: user.id },
      });

      return res.json({
        success: true,
        message: "Upscale deleted successfully",
      });
    } catch (error) {
      console.error("Delete image upscale error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
}
