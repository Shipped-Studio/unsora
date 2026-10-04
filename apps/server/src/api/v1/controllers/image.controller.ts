import { Request, Response } from "express";
import prisma from "../../../lib/db";
import { ImageGenerationType } from "@prisma/client";
import { handlePublicError } from "../helpers/public-response";

const imageGenerationInclude = {
  outputAsset: true,
  thumbnailAsset: true,
  referenceAssets: {
    include: { asset: true },
    orderBy: { order: "asc" as const },
  },
};

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

export class PublicImageController {
  getGenerations = async (req: Request, res: Response) => {
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
  };

  getGeneration = async (req: Request, res: Response) => {
    try {
      const { generationId } = req.params;
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
          type: ImageGenerationType.BASIC,
        },
        include: imageGenerationInclude,
      });

      if (!generation) {
        return res
          .status(404)
          .json({ success: false, error: "Generation not found" });
      }

      return res.json({ success: true, generation });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Public get image generation error:",
        "Failed to fetch image generation",
      );
    }
  };

  deleteGeneration = async (req: Request, res: Response) => {
    try {
      const { generationId } = req.params;
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

      const deleted = await prisma.imageGeneration.deleteMany({
        where: {
          id: generationId,
          userId: user.id,
          type: ImageGenerationType.BASIC,
        },
      });

      if (deleted.count === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Generation not found" });
      }

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
  };

}
