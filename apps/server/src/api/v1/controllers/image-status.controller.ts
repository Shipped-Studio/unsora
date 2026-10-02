import { Request, Response } from "express";
import { ImageGenerationType } from "@prisma/client";
import prisma from "../../../lib/db";

const POLLABLE_IMAGE_TYPES: ImageGenerationType[] = [
  ImageGenerationType.BASIC,
  ImageGenerationType.INFLUENCER,
  ImageGenerationType.THUMBNAIL,
  ImageGenerationType.UPSCALE,
  ImageGenerationType.MOVIE_MATERIALS,
];

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

export class PublicImageStatusController {
  getStatus = async (req: Request, res: Response) => {
    try {
      const { id: generationId } = req.params;

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
          type: { in: POLLABLE_IMAGE_TYPES },
        },
        include: {
          outputAsset: true,
          thumbnailAsset: true,
        },
      });

      if (!generation) {
        return res
          .status(404)
          .json({ success: false, error: "Generation not found" });
      }

      const isCompleted = generation.status === "COMPLETED";

      return res.json({
        success: true,
        data: {
          id: generation.id,
          status: generation.status,
          outputUrl: generation.outputAsset?.url ?? null,
          error: generation.error,
          createdAt: generation.createdAt.toISOString(),
          updatedAt: generation.updatedAt.toISOString(),
          completedAt: isCompleted ? generation.updatedAt.toISOString() : null,
        },
      });
    } catch (error) {
      console.error("Get image generation status error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  };
}
