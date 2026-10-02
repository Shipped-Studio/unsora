import { Request, Response } from "express";
import { VideoGenerationType } from "@prisma/client";
import prisma from "../lib/db";
import { VIDEO_MODELS } from "../config/models";
import { createAsset } from "../lib/asset-utils";
import { addVideoGenerationJob } from "../queue/video-generation.queue";
import {
  consumeCredits,
  getCreditBalance,
  InsufficientCreditsError,
} from "../lib/credits";

const VALID_MODELS = Object.keys(VIDEO_MODELS);

const isSeedanceModel = (modelKey: string) => modelKey.startsWith("seedance");

function resolveGenerationMode(
  modelKey: string,
  mode?: string,
  image?: string,
): VideoGenerationType {
  if (modelKey === "veo") {
    switch (mode) {
      case "reference":
        return VideoGenerationType.IMAGE_TO_VIDEO;
      case "first-last-frame":
        return VideoGenerationType.FIRST_LAST_FRAMES;
      case "material":
        return VideoGenerationType.OMNI_REFERENCE;
      default:
        return VideoGenerationType.TEXT_TO_VIDEO;
    }
  }
  return image ? VideoGenerationType.IMAGE_TO_VIDEO : VideoGenerationType.TEXT_TO_VIDEO;
}

export class VideoGenerationController {
  async createVideo(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const {
        model: modelKey,
        prompt,
        negative_prompt,
        duration = 5,
        aspect_ratio = "16:9",
        resolution: requestedResolution,
        sound = false,
        mode,
        image,
        end_image,
        reference_images,
        start_frame,
        end_frame,
        audio,
        imageUrls,
      } = req.body;

      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Prompt is required" });
      }

      if (!modelKey || !VALID_MODELS.includes(modelKey)) {
        return res.status(400).json({
          success: false,
          error: `Invalid model. Must be one of: ${VALID_MODELS.join(", ")}`,
        });
      }

      const modelDef = VIDEO_MODELS[modelKey];
      const seedance = isSeedanceModel(modelKey);

      const dur = Number(duration);

      const [minDur, maxDur] = modelDef.durationRange;
      if (!Number.isInteger(dur) || dur < minDur || dur > maxDur) {
        return res.status(400).json({
          success: false,
          error: `Duration must be an integer between ${minDur} and ${maxDur}`,
        });
      }

      if (!seedance && sound && !modelDef.supportsSound) {
        return res.status(400).json({
          success: false,
          error: `Model ${modelKey} does not support sound`,
        });
      }

      // Resolution is fixed per model variant where the provider ties quality to
      // the variant (Seedance 2.0 = 1080p, Fast = 720p); the config wins over the
      // body so the resolution we submit always matches the tier we charge for.
      const resolution: string | undefined =
        modelDef.outputResolution ?? requestedResolution;

      if (!modelDef.outputResolution && resolution && modelDef.resolution) {
        if (!modelDef.resolution.includes(resolution)) {
          return res.status(400).json({
            success: false,
            error: `resolution must be one of: ${modelDef.resolution.join(", ")}`,
          });
        }
      }

      // Seedance overloads `sound` in credits() to mean "has video reference
      // input". This route accepts no video references, so it is never the
      // video tier. Omni Flash overloads it to mean "reference-to-video"
      // (reference images attached), which bills at a higher rate.
      const omniFlashRefs =
        modelKey === "gemini-omni-flash" &&
        Array.isArray(reference_images) &&
        reference_images.length > 0;
      const creditsRequired = modelDef.credits({
        duration: dur,
        sound: seedance ? false : omniFlashRefs || !!sound,
        resolution,
      });

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

      const functionMode = resolveGenerationMode(modelKey, mode, image);

      let imageAssetId: string | undefined;
      let endImageAssetId: string | undefined;

      if (image) {
        const a = await createAsset({ userId: user.id, url: image, name: "Generation image", type: "IMAGE", source: "UPLOAD" });
        imageAssetId = a.id;
      }
      if (end_image) {
        const a = await createAsset({ userId: user.id, url: end_image, name: "Generation end image", type: "IMAGE", source: "UPLOAD" });
        endImageAssetId = a.id;
      }

      const generation = await prisma.generation.create({
        data: {
          userId: user.id,
          model: modelDef.dbModel,
          prompt: prompt.trim(),
          negativePrompt: negative_prompt?.trim() || null,
          functionMode,
          ratio: aspect_ratio,
          duration: dur,
          resolution: resolution || null,
          sound: !!sound,
          imageAssetId: imageAssetId || null,
          endImageAssetId: endImageAssetId || null,
          creditsUsed: creditsRequired,
          status: "QUEUED",
        },
      });

      const inputAssetEntries: { assetId: string; role: string; order: number }[] = [];

      if (imageUrls?.length) {
        for (let i = 0; i < imageUrls.length; i++) {
          const asset = await createAsset({ userId: user.id, url: imageUrls[i], name: `Image ${i + 1}`, type: "IMAGE", source: "UPLOAD" });
          inputAssetEntries.push({ assetId: asset.id, role: "IMAGE_FILE", order: i });
        }
      }

      if (reference_images?.length) {
        for (let i = 0; i < reference_images.length; i++) {
          const asset = await createAsset({ userId: user.id, url: reference_images[i], name: `Reference image ${i + 1}`, type: "IMAGE", source: "UPLOAD" });
          inputAssetEntries.push({ assetId: asset.id, role: "IMAGE_FILE", order: i });
        }
      }

      if (audio) {
        const asset = await createAsset({ userId: user.id, url: audio, name: "Audio file", type: "AUDIO", source: "UPLOAD" });
        inputAssetEntries.push({ assetId: asset.id, role: "AUDIO_FILE", order: 0 });
      }

      const frames = [start_frame, end_frame].filter(Boolean);
      for (let i = 0; i < frames.length; i++) {
        const asset = await createAsset({ userId: user.id, url: frames[i], name: `Frame ${i + 1}`, type: "IMAGE", source: "UPLOAD" });
        inputAssetEntries.push({ assetId: asset.id, role: "FRAME_PATH", order: i });
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

      let creditTransactionId: string;
      let creditsRemaining: number;
      try {
        const consumption = await consumeCredits({
          userId: user.id,
          amount: creditsRequired,
          reason: "video.generation",
          metadata: { generationId: generation.id, model: modelDef.dbModel },
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

      const job = await addVideoGenerationJob({
        userId: user.id,
        generationId: generation.id,
        creditsUsed: creditsRequired,
        creditTransactionId,
        modelKey,
        prompt: prompt.trim(),
        negativePrompt: negative_prompt?.trim(),
        aspectRatio: aspect_ratio,
        duration: dur,
        resolution,
        sound: !!sound,
        mode,
        image,
        endImage: end_image,
        referenceImages: reference_images,
        startFrame: start_frame,
        endFrame: end_frame,
        audio,
        imageUrls,
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

      const dbModels = Object.values(VIDEO_MODELS).map((m) => m.dbModel);

      const where = { userId: user.id, model: { in: dbModels } };

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
      console.error("Get video generations error:", error);
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
      console.error("Refresh video generation status error:", error);
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
      console.error("Delete video generation error:", error);
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
      console.error("Delete video generations error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
}
