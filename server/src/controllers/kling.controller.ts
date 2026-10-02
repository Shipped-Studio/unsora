import { Request, Response } from "express";
import { VideoGenerationType } from "@prisma/client";
import prisma from "../lib/db";
import { addKlingGenerationJob } from "../queue/video-generation.queue";
import { createAsset } from "../lib/asset-utils";
import { klingV3Pro } from "../config/models";
import {
  consumeCredits,
  getCreditBalance,
  InsufficientCreditsError,
} from "../lib/credits";

export class KlingController {
  async createVideo(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const {
        prompt,
        aspect_ratio = "16:9",
        cfg_scale = 0.5,
        duration = 5,
        sound = false,
        image,
        end_image,
      } = req.body;

      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Prompt is required" });
      }

      if (!klingV3Pro.aspectRatio!.includes(aspect_ratio)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid aspect ratio" });
      }

      const cfgVal = Number(cfg_scale);
      if (isNaN(cfgVal) || cfgVal < 0 || cfgVal > 1) {
        return res
          .status(400)
          .json({ success: false, error: "cfg_scale must be between 0 and 1" });
      }

      const dur = Number(duration);
      const [minDur, maxDur] = klingV3Pro.durationRange;
      if (!Number.isInteger(dur) || dur < minDur || dur > maxDur) {
        return res
          .status(400)
          .json({
            success: false,
            error: `Duration must be an integer between ${minDur} and ${maxDur}`,
          });
      }

      if (!process.env.WAVESPEED_API_KEY) {
        return res
          .status(500)
          .json({
            success: false,
            error: "WaveSpeed API key is not configured",
          });
      }

      const creditsRequired = klingV3Pro.credits({ duration: dur, sound: !!sound });

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });

      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const balance = await getCreditBalance(user.id);
      if (balance < creditsRequired) {
        return res.status(402).json({
          success: false,
          error: `Insufficient credits. Need ${creditsRequired}, have ${balance}`,
          creditsRemaining: balance,
        });
      }

      const isImageMode = !!image;
      const functionMode: VideoGenerationType = isImageMode
        ? VideoGenerationType.FIRST_LAST_FRAMES
        : VideoGenerationType.TEXT_TO_VIDEO;

      let imageAssetId: string | undefined;
      let endImageAssetId: string | undefined;

      if (image) {
        const a = await createAsset({ userId: user.id, url: image, name: "Kling image", type: "IMAGE", source: "UPLOAD" });
        imageAssetId = a.id;
      }
      if (end_image) {
        const a = await createAsset({ userId: user.id, url: end_image, name: "Kling end image", type: "IMAGE", source: "UPLOAD" });
        endImageAssetId = a.id;
      }

      const generation = await prisma.generation.create({
        data: {
          userId: user.id,
          model: klingV3Pro.dbModel,
          prompt: prompt.trim(),
          functionMode,
          ratio: aspect_ratio,
          duration: dur,
          cfgScale: cfgVal,
          creditsUsed: creditsRequired,
          status: "QUEUED",
          imageAssetId: imageAssetId || null,
          endImageAssetId: endImageAssetId || null,
        },
      });

      let creditTransactionId: string;
      let creditsRemaining: number;
      try {
        const consumption = await consumeCredits({
          userId: user.id,
          amount: creditsRequired,
          reason: "video.generation.kling",
          metadata: { generationId: generation.id },
        });
        creditTransactionId = consumption.transactionId;
        creditsRemaining = consumption.balanceAfter;
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          await prisma.generation.delete({ where: { id: generation.id } }).catch(() => {});
          return res.status(402).json({
            success: false,
            error: err.message,
            creditsRemaining: err.available,
          });
        }
        throw err;
      }

      const job = await addKlingGenerationJob({
        userId: user.id,
        generationId: generation.id,
        creditsUsed: creditsRequired,
        creditTransactionId,
        prompt: prompt.trim(),
        aspectRatio: aspect_ratio,
        cfgScale: cfgVal,
        duration: dur,
        sound: !!sound,
        image: image || undefined,
        endImage: end_image || undefined,
      });

      return res.json({
        success: true,
        generation: {
          id: generation.id,
          status: "QUEUED",
        },
        creditsDeducted: creditsRequired,
        creditsRemaining,
      });
    } catch (error) {
      console.error("Create Kling video error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async getGenerations(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(
        Math.max(parseInt(req.query.limit as string) || 12, 1),
        100,
      );
      const offset = (page - 1) * limit;

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });

      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const where = { userId: user.id, model: klingV3Pro.dbModel };

      const [generations, totalCount] = await Promise.all([
        prisma.generation.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          include: {
            outputAsset: true,
            thumbnailAsset: true,
            imageAsset: true,
            endImageAsset: true,
            inputAssets: { include: { asset: true }, orderBy: { order: "asc" } },
          },
        }),
        prisma.generation.count({ where }),
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
      console.error("Get Kling generations error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async refreshStatus(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;
      const { generationId } = req.params;

      if (!generationId) {
        return res
          .status(400)
          .json({ success: false, error: "Generation ID is required" });
      }

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });

      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const generation = await prisma.generation.findFirst({
        where: { id: generationId, userId: user.id },
        include: {
          outputAsset: true,
          thumbnailAsset: true,
          imageAsset: true,
          endImageAsset: true,
          inputAssets: { include: { asset: true }, orderBy: { order: "asc" } },
        },
      });

      if (!generation) {
        return res
          .status(404)
          .json({ success: false, error: "Generation not found" });
      }

      return res.json({ success: true, generation });
    } catch (error) {
      console.error("Refresh Kling generation status error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async deleteGeneration(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;
      const { generationId } = req.params;

      if (!generationId) {
        return res
          .status(400)
          .json({ success: false, error: "Generation ID is required" });
      }

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });

      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      await prisma.generation.delete({
        where: { id: generationId, userId: user.id },
      });

      return res.json({
        success: true,
        message: "Generation deleted successfully",
      });
    } catch (error) {
      console.error("Delete Kling generation error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
}
