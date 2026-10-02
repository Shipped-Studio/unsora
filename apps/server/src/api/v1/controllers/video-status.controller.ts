import { Request, Response } from "express";
import prisma from "../../../lib/db";
import { MOTION_CONTROL_MODELS, VIDEO_MODELS } from "../../../config/models";
import { handlePublicError } from "../helpers/public-response";

/** Generation rows this endpoint serves: text/image-to-video and motion control. */
const VIDEO_DB_MODELS = [
  ...Object.values(VIDEO_MODELS).map((m) => m.dbModel),
  ...Object.values(MOTION_CONTROL_MODELS).map((m) => m.dbModel),
];

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

interface VideoStatus {
  id: string;
  model: string | null;
  status: string;
  outputUrl: string | null;
  thumbnailUrl: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** ProcessedVideo stores lowercase free-form statuses; map onto GenerationStatus. */
function normalizeProcessedStatus(status: string): string {
  const upper = status.toUpperCase();
  if (upper === "QUEUED" || upper === "COMPLETED" || upper === "FAILED") {
    return upper;
  }
  return "PROCESSING";
}

/**
 * Any job that produces a video polls here: video generations, motion control,
 * talking avatars, and processed videos (upscaling, watermark removal).
 */
async function findVideoJob(
  id: string,
  userId: string,
): Promise<VideoStatus | null> {
  const generation = await prisma.generation.findFirst({
    where: { id, userId, model: { in: VIDEO_DB_MODELS } },
    include: { outputAsset: true, thumbnailAsset: true },
  });
  if (generation) {
    return {
      id: generation.id,
      model: generation.model,
      status: generation.status,
      outputUrl: generation.outputAsset?.url ?? null,
      thumbnailUrl: generation.thumbnailAsset?.url ?? null,
      error: generation.error,
      createdAt: generation.createdAt,
      updatedAt: generation.updatedAt,
    };
  }

  const avatar = await prisma.avatarGeneration.findFirst({
    where: { id, userId },
    include: { outputAsset: true },
  });
  if (avatar) {
    return {
      id: avatar.id,
      model: avatar.model,
      status: avatar.status,
      outputUrl: avatar.outputAsset?.url ?? null,
      thumbnailUrl: null,
      error: avatar.error,
      createdAt: avatar.createdAt,
      updatedAt: avatar.updatedAt,
    };
  }

  const processed = await prisma.processedVideo.findFirst({
    where: { id, userId },
    include: { processedAsset: true },
  });
  if (processed) {
    return {
      id: processed.id,
      model: processed.operations.includes("UPSCALING")
        ? `upscale-${processed.upscaleModel ?? "standard"}`
        : "watermark-removal",
      status: normalizeProcessedStatus(processed.status),
      outputUrl: processed.processedAsset?.url ?? null,
      thumbnailUrl: null,
      error: processed.error,
      createdAt: processed.createdAt,
      updatedAt: processed.updatedAt,
    };
  }

  return null;
}

export class PublicVideoStatusController {
  getStatus = async (req: Request, res: Response) => {
    try {
      const { id: generationId } = req.params;

      if (!generationId) {
        return res.status(400).json({
          success: false,
          error: "Generation ID is required",
        });
      }

      const user = await resolveUser(req.auth.userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const job = await findVideoJob(generationId, user.id);

      if (!job) {
        return res
          .status(404)
          .json({ success: false, error: "Video generation not found" });
      }

      const isCompleted = job.status === "COMPLETED";

      return res.json({
        success: true,
        data: {
          id: job.id,
          model: job.model,
          status: job.status,
          outputUrl: job.outputUrl,
          thumbnailUrl: job.thumbnailUrl,
          error: job.error,
          createdAt: job.createdAt.toISOString(),
          updatedAt: job.updatedAt.toISOString(),
          completedAt: isCompleted ? job.updatedAt.toISOString() : null,
        },
      });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Get video status error:",
        "Failed to fetch video generation status",
      );
    }
  };
}
