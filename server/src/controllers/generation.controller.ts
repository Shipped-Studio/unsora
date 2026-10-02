import { Request, Response } from "express";
import prisma from "../lib/db";
import { addVideoGenerationJob } from "../queue/video-generation.queue";
import { createAsset } from "../lib/asset-utils";
import {
  seedance20,
  seedance20Fast,
  seedance20Mini,
  type VideoModelConfig,
} from "../config/models";
import {
  consumeCredits,
  getCreditBalance,
  InsufficientCreditsError,
} from "../lib/credits";

const SEEDANCE_CONFIGS: Record<string, VideoModelConfig> = {
  "seedance_2.0": seedance20,
  "seedance_2.0_fast": seedance20Fast,
  "seedance_2.0_mini": seedance20Mini,
};

const VALID_SEEDANCE_MODELS = Object.keys(SEEDANCE_CONFIGS);

export function calculateCredits(
  model: string,
  duration: number,
  hasVideoInput: boolean,
): number {
  const config = SEEDANCE_CONFIGS[model] ?? seedance20Fast;
  return config.credits({ duration, sound: hasVideoInput });
}

export class GenerationController {
  async createVideo(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const {
        model = "seedance_2.0_fast",
        prompt,
        functionMode = "omni_reference",
        ratio = "16:9",
        duration = 5,
        image_files,
        video_files,
        audio_files,
        filePaths,
        generate_audio = false,
      } = req.body;

      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Prompt is required" });
      }

      if (!VALID_SEEDANCE_MODELS.includes(model)) {
        return res.status(400).json({ success: false, error: "Invalid model" });
      }

      const modelConfig = SEEDANCE_CONFIGS[model];
      const resolution = modelConfig.outputResolution;
      if (!resolution) {
        return res.status(500).json({
          success: false,
          error: "Model resolution is not configured",
        });
      }

      if (!["omni_reference", "first_last_frames"].includes(functionMode)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid functionMode" });
      }

      if (!modelConfig.aspectRatio!.includes(ratio)) {
        return res.status(400).json({ success: false, error: "Invalid ratio" });
      }

      const dur = Number(duration);
      const [minDur, maxDur] = modelConfig.durationRange;
      if (!Number.isInteger(dur) || dur < minDur || dur > maxDur) {
        return res
          .status(400)
          .json({
            success: false,
            error: `Duration must be an integer between ${minDur} and ${maxDur}`,
          });
      }

      const mf = modelConfig.maxFiles!;

      if (functionMode === "omni_reference") {
        if (
          image_files &&
          (!Array.isArray(image_files) || image_files.length > mf.images!)
        ) {
          return res
            .status(400)
            .json({
              success: false,
              error: `image_files must be an array of at most ${mf.images} URLs`,
            });
        }
        if (
          video_files &&
          (!Array.isArray(video_files) || video_files.length > mf.videos!)
        ) {
          return res
            .status(400)
            .json({
              success: false,
              error: `video_files must be an array of at most ${mf.videos} URLs`,
            });
        }
        if (
          audio_files &&
          (!Array.isArray(audio_files) || audio_files.length > mf.audio!)
        ) {
          return res
            .status(400)
            .json({
              success: false,
              error: `audio_files must be an array of at most ${mf.audio} URLs`,
            });
        }
      }

      if (functionMode === "first_last_frames") {
        if (filePaths && (!Array.isArray(filePaths) || filePaths.length > 2)) {
          return res
            .status(400)
            .json({
              success: false,
              error: "filePaths must be an array of at most 2 image URLs",
            });
        }
      }

      const hasVideoInput =
        video_files && Array.isArray(video_files) && video_files.length > 0;
      const creditsRequired = calculateCredits(model, dur, hasVideoInput);

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

      const modeEnum =
        functionMode === "omni_reference"
          ? "OMNI_REFERENCE"
          : "FIRST_LAST_FRAMES";

      // Create DB record
      const generation = await prisma.generation.create({
        data: {
          userId: user.id,
          model,
          prompt: prompt.trim(),
          functionMode: modeEnum,
          ratio,
          duration: dur,
          resolution,
          creditsUsed: creditsRequired,
          status: "QUEUED",
        },
      });

      const inputAssetEntries: { assetId: string; role: string; order: number }[] = [];

      if (image_files?.length) {
        for (let i = 0; i < image_files.length; i++) {
          const asset = await createAsset({ userId: user.id, url: image_files[i], name: `Image file ${i + 1}`, type: "IMAGE", source: "UPLOAD" });
          inputAssetEntries.push({ assetId: asset.id, role: "IMAGE_FILE", order: i });
        }
      }
      if (video_files?.length) {
        for (let i = 0; i < video_files.length; i++) {
          const asset = await createAsset({ userId: user.id, url: video_files[i], name: `Video file ${i + 1}`, type: "VIDEO", source: "UPLOAD" });
          inputAssetEntries.push({ assetId: asset.id, role: "VIDEO_FILE", order: i });
        }
      }
      if (audio_files?.length) {
        for (let i = 0; i < audio_files.length; i++) {
          const asset = await createAsset({ userId: user.id, url: audio_files[i], name: `Audio file ${i + 1}`, type: "AUDIO", source: "UPLOAD" });
          inputAssetEntries.push({ assetId: asset.id, role: "AUDIO_FILE", order: i });
        }
      }
      if (filePaths?.length) {
        for (let i = 0; i < filePaths.length; i++) {
          const asset = await createAsset({ userId: user.id, url: filePaths[i], name: `Frame ${i + 1}`, type: "IMAGE", source: "UPLOAD" });
          inputAssetEntries.push({ assetId: asset.id, role: "FRAME_PATH", order: i });
        }
      }

      if (inputAssetEntries.length > 0) {
        await prisma.generationInputAsset.createMany({
          data: inputAssetEntries.map((e) => ({
            generationId: generation.id,
            assetId: e.assetId,
            role: e.role as any,
            order: e.order,
          })),
        });
      }

      // Atomically reserve the credits from the bucket system. The earlier
      // cached check is a fast UX bail-out; this is the source-of-truth check.
      let creditTransactionId: string;
      let creditsRemaining: number;
      try {
        const consumption = await consumeCredits({
          userId: user.id,
          amount: creditsRequired,
          reason: "video.generation.seedance",
          metadata: { generationId: generation.id, model },
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

      // Dispatch to the WaveSpeed pipeline (legacy input names mapped onto
      // the unified job shape).
      await addVideoGenerationJob({
        userId: user.id,
        generationId: generation.id,
        creditsUsed: creditsRequired,
        creditTransactionId,
        modelKey: modelConfig.key,
        prompt: prompt.trim(),
        aspectRatio: ratio,
        duration: dur,
        resolution,
        sound: false,
        generateAudio: Boolean(generate_audio),
        referenceImages: image_files,
        referenceVideos: video_files,
        referenceAudios: audio_files,
        image: filePaths?.[0],
        endImage: filePaths?.[1],
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
      console.error("Create video generation error:", error);
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

      const baseWhere = {
        userId: user.id,
        functionMode: { not: "MOTION_CONTROL" as const },
      };

      const [generations, totalCount] = await Promise.all([
        prisma.generation.findMany({
          where: baseWhere,
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
        prisma.generation.count({ where: baseWhere }),
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
      console.error("Get generations error:", error);
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
      console.error("Refresh generation status error:", error);
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
      console.error("Delete generation error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async deleteGenerations(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;
      const { generationIds } = req.body;

      if (
        !generationIds ||
        !Array.isArray(generationIds) ||
        generationIds.length === 0
      ) {
        return res
          .status(400)
          .json({ success: false, error: "Generation IDs array is required" });
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

      const result = await prisma.generation.deleteMany({
        where: { id: { in: generationIds }, userId: user.id },
      });

      return res.json({
        success: true,
        message: "Generations deleted successfully",
        count: result.count,
      });
    } catch (error) {
      console.error("Delete generations error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
}
