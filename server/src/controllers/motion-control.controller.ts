import { Request, Response } from "express";
import prisma from "../lib/db";
import { addMotionControlJob } from "../queue/video-generation.queue";
import { createAsset } from "../lib/asset-utils";
import { VideoGenerationType } from "@prisma/client";
import {
  MOTION_CONTROL_MODELS,
  klingMc30Pro,
  type MotionControlModelConfig,
} from "../config/models";
import {
  consumeCredits,
  getCreditBalance,
  InsufficientCreditsError,
} from "../lib/credits";

const MC_BY_DB_MODEL: Record<string, MotionControlModelConfig> =
  Object.fromEntries(
    Object.values(MOTION_CONTROL_MODELS).map((c) => [c.dbModel, c]),
  );

const VALID_MODELS = Object.keys(MC_BY_DB_MODEL);

function calculateMotionControlCredits(
  model: string,
  resolution: string,
  duration = 10,
): number {
  const config = MC_BY_DB_MODEL[model] ?? klingMc30Pro;
  return config.credits({ duration, resolution });
}

export class MotionControlController {
  async createGeneration(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const {
        model = "kling_mc_3.0_pro",
        prompt = "",
        motion_video_url,
        character_image_url,
        resolution = "720p",
        keep_sound = true,
        character_orientation = "video",
      } = req.body;

      if (!motion_video_url || typeof motion_video_url !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "Motion video URL is required" });
      }

      if (!character_image_url || typeof character_image_url !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "Character image URL is required" });
      }

      if (!VALID_MODELS.includes(model)) {
        return res.status(400).json({ success: false, error: "Invalid model" });
      }

      const modelConfig = MC_BY_DB_MODEL[model];

      if (!modelConfig.validResolutions.includes(resolution)) {
        return res.status(400).json({
          success: false,
          error: `Invalid resolution. Must be one of: ${modelConfig.validResolutions.join(", ")}`,
        });
      }

      if (!modelConfig.validOrientations.includes(character_orientation)) {
        return res.status(400).json({
          success: false,
          error: `Invalid character orientation. Must be one of: ${modelConfig.validOrientations.join(", ")}`,
        });
      }

      if (!process.env.WAVESPEED_API_KEY) {
        return res.status(500).json({
          success: false,
          error: "WaveSpeed API key is not configured",
        });
      }

      const creditsRequired = calculateMotionControlCredits(model, resolution);

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

      const generation = await prisma.generation.create({
        data: {
          userId: user.id,
          model,
          functionMode: "MOTION_CONTROL",
          prompt: typeof prompt === "string" ? prompt.trim() : "",
          ratio: resolution,
          characterOrientation: character_orientation,
          creditsUsed: creditsRequired,
          status: "QUEUED",
        },
      });

      const motionVideoAsset = await createAsset({ userId: user.id, url: motion_video_url, name: "Motion video", type: "VIDEO", source: "UPLOAD" });
      const characterImageAsset = await createAsset({ userId: user.id, url: character_image_url, name: "Character image", type: "IMAGE", source: "UPLOAD" });

      await prisma.generationInputAsset.createMany({
        data: [
          { generationId: generation.id, assetId: motionVideoAsset.id, role: "VIDEO_FILE" as any, order: 0 },
          { generationId: generation.id, assetId: characterImageAsset.id, role: "IMAGE_FILE" as any, order: 0 },
        ],
      });

      let creditTransactionId: string;
      let creditsRemaining: number;
      try {
        const consumption = await consumeCredits({
          userId: user.id,
          amount: creditsRequired,
          reason: "video.generation.motion-control",
          metadata: { generationId: generation.id, model, resolution },
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

      const job = await addMotionControlJob({
        userId: user.id,
        generationId: generation.id,
        creditsUsed: creditsRequired,
        creditTransactionId,
        model,
        prompt: typeof prompt === "string" ? prompt.trim() : "",
        motionVideoUrl: motion_video_url,
        characterImageUrl: character_image_url,
        resolution,
        keepSound: !!keep_sound,
        characterOrientation: character_orientation,
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
      console.error("Create motion control generation error:", error);
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

      const where = {
        userId: user.id,
        functionMode: VideoGenerationType.MOTION_CONTROL,
      };

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
      console.error("Get motion control generations error:", error);
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
      console.error("Refresh motion control status error:", error);
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
      console.error("Delete motion control generation error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
}
