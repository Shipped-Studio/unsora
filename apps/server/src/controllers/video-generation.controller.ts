import { Request, Response } from "express";
import prisma from "../lib/db";
import { VIDEO_MODELS } from "../config/models";
import { catalogDbModels } from "../config/catalog";

export class VideoGenerationController {
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

      const dbModels = [
        ...Object.values(VIDEO_MODELS).map((m) => m.dbModel),
        ...catalogDbModels("video"),
      ];

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
