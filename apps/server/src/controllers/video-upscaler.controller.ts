import { Request, Response } from "express";
import prisma from "../lib/db";
import {
  addVideoUpscaleJob,
  VideoUpscaleModel,
} from "../queue/video-upscale.queue";
import { VIDEO_UPSCALE_MODELS } from "../config/models";
import { createAsset } from "../lib/asset-utils";
import {
  consumeCredits,
  getCreditBalance,
  InsufficientCreditsError,
} from "../lib/credits";
import { DURATION_TOLERANCE_SECONDS, measureMediaSeconds } from "../lib/media-limits";

/** Longest video the upscaler takes; the price tiers assume this cap. */
const MAX_UPSCALE_SECONDS = 25;

const VALID_MODELS: VideoUpscaleModel[] = Object.keys(
  VIDEO_UPSCALE_MODELS,
) as VideoUpscaleModel[];

function getCreditsForVideo(model: VideoUpscaleModel, durationSec: number): number {
  const config = VIDEO_UPSCALE_MODELS[model];
  if (!config) return VIDEO_UPSCALE_MODELS["standard"].credits({ duration: durationSec });
  return config.credits({ duration: durationSec });
}

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

export class VideoUpscalerController {
  // POST /api/video-upscaler/create
  async create(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const { videoUrl, model = "standard" } = req.body;

      if (!videoUrl || typeof videoUrl !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "videoUrl is required" });
      }

      if (!VALID_MODELS.includes(model)) {
        return res.status(400).json({
          success: false,
          error: `Invalid model. Must be one of: ${VALID_MODELS.join(", ")}`,
        });
      }

      // Priced from the video's real length, never a client-sent duration.
      const durationSec = await measureMediaSeconds(videoUrl);
      if (!durationSec) {
        return res.status(400).json({
          success: false,
          error: "Couldn't read the video's length. Upload an MP4, WebM or MOV file.",
        });
      }
      if (durationSec > MAX_UPSCALE_SECONDS + DURATION_TOLERANCE_SECONDS) {
        return res.status(400).json({
          success: false,
          error: `Videos can be up to ${MAX_UPSCALE_SECONDS} seconds long.`,
        });
      }

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const creditCost = getCreditsForVideo(model as VideoUpscaleModel, durationSec);

      const balance = await getCreditBalance(user.id);
      if (balance < creditCost) {
        return res.status(402).json({
          success: false,
          error: `Insufficient credits. Need ${creditCost}, have ${balance}`,
          creditsRemaining: balance,
        });
      }

      const originalAsset = await createAsset({
        userId: user.id,
        url: videoUrl,
        name: req.body.originalName || "video-upscale",
        type: "VIDEO",
        source: "UPLOAD",
      });
      const record = await prisma.processedVideo.create({
        data: {
          userId: user.id,
          originalName: req.body.originalName || "video-upscale",
          originalAssetId: originalAsset.id,
          operations: ["UPSCALING"],
          creditsUsed: creditCost,
          status: "queued",
          upscaleModel: model,
        },
      });

      let creditTransactionId: string;
      let creditsRemaining: number;
      try {
        const consumption = await consumeCredits({
          userId: user.id,
          amount: creditCost,
          reason: "video.upscale",
          metadata: { processedVideoId: record.id, model },
        });
        creditTransactionId = consumption.transactionId;
        creditsRemaining = consumption.balanceAfter;
      } catch (err) {
        await prisma.processedVideo.delete({ where: { id: record.id } }).catch(() => {});
        if (err instanceof InsufficientCreditsError) {
          return res.status(402).json({
            success: false,
            error: err.message,
            creditsRemaining: err.available,
          });
        }
        throw err;
      }

      const queueJob = await addVideoUpscaleJob({
        userId: user.id,
        jobId: record.id,
        creditsUsed: creditCost,
        creditTransactionId,
        videoUrl,
        model: model as VideoUpscaleModel,
      });

      return res.json({
        success: true,
        job: {
          id: record.id,
          status: "queued",
          model,
        },
        creditsDeducted: creditCost,
        creditsRemaining,
      });
    } catch (error) {
      console.error("Create video upscale error:", error);
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  // GET /api/video-upscaler/all
  async getAll(req: Request, res: Response) {
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

      const where = {
        userId: user.id,
        operations: { has: "UPSCALING" as const },
      };

      const [jobs, totalCount] = await Promise.all([
        prisma.processedVideo.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          select: {
            id: true,
            originalName: true,
            originalAsset: true,
            processedAsset: true,
            operations: true,
            creditsUsed: true,
            status: true,
            error: true,
            upscaleModel: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.processedVideo.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return res.json({
        success: true,
        jobs,
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
      console.error("Get video upscales error:", error);
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  // GET /api/video-upscaler/refresh/:jobId
  async refreshStatus(req: Request, res: Response) {
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

      const job = await prisma.processedVideo.findFirst({
        where: { id: jobId, userId: user.id },
        select: {
          id: true,
          originalName: true,
          originalAsset: true,
          processedAsset: true,
          operations: true,
          creditsUsed: true,
          status: true,
          error: true,
          upscaleModel: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!job) {
        return res
          .status(404)
          .json({ success: false, error: "Upscale job not found" });
      }

      return res.json({ success: true, job });
    } catch (error) {
      console.error("Refresh video upscale status error:", error);
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  // DELETE /api/video-upscaler/:jobId
  async delete(req: Request, res: Response) {
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

      await prisma.processedVideo.delete({
        where: { id: jobId, userId: user.id },
      });

      return res.json({
        success: true,
        message: "Upscale job deleted successfully",
      });
    } catch (error) {
      console.error("Delete video upscale error:", error);
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  // DELETE /api/video-upscaler/ (bulk)
  async deleteMany(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;
      const { jobIds } = req.body;

      if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "jobIds array is required" });
      }

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const deleted = await prisma.processedVideo.deleteMany({
        where: { id: { in: jobIds }, userId: user.id },
      });

      return res.json({
        success: true,
        message: "Upscale jobs deleted successfully",
        count: deleted.count,
      });
    } catch (error) {
      console.error("Delete video upscales error:", error);
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
}
