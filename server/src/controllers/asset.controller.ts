import { Request, Response } from "express";
import {
  type Prisma,
  ImageGenerationType,
  VideoGenerationType,
  VideoOperation,
} from "@prisma/client";
import prisma from "../lib/db";
import {
  findUserFolder,
  uploadAssetToLibraryItem,
} from "./library.controller";

const VALID_VIDEO_FEATURES = new Set<VideoGenerationType>([
  VideoGenerationType.OMNI_REFERENCE,
  VideoGenerationType.FIRST_LAST_FRAMES,
  VideoGenerationType.TEXT_TO_VIDEO,
  VideoGenerationType.IMAGE_TO_VIDEO,
  VideoGenerationType.MOTION_CONTROL,
]);

const VALID_PROCESSED_VIDEO_FEATURES = new Set<VideoOperation>([
  VideoOperation.WATERMARK_REMOVAL,
  VideoOperation.UPSCALING,
]);

const VALID_IMAGE_FEATURES = new Set<ImageGenerationType>([
  ImageGenerationType.BASIC,
  ImageGenerationType.MOVIE_MATERIALS,
  ImageGenerationType.INFLUENCER,
  ImageGenerationType.UPSCALE,
]);

export class AssetController {
  async browse(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const type = (req.query.type as string) || "uploaded";
      const rawFeature = req.query.feature as string | undefined;
      const feature = rawFeature ? rawFeature.toUpperCase() : undefined;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(req.query.limit as string) || 12)
      );
      const skip = (page - 1) * limit;

      let items: Record<string, unknown>[] = [];
      let totalCount = 0;
      const videoFeature =
        type === "video" &&
        feature &&
        VALID_VIDEO_FEATURES.has(feature as VideoGenerationType)
          ? (feature as VideoGenerationType)
          : undefined;
      const imageFeature =
        type === "image" &&
        feature &&
        VALID_IMAGE_FEATURES.has(feature as ImageGenerationType)
          ? (feature as ImageGenerationType)
          : undefined;
      const processedVideoFeature =
        type === "video" &&
        feature &&
        VALID_PROCESSED_VIDEO_FEATURES.has(feature as VideoOperation)
          ? (feature as VideoOperation)
          : undefined;

      if (type === "video") {
        if (processedVideoFeature) {
          const where: Prisma.ProcessedVideoWhereInput = {
            userId: user.id,
            operations: { has: processedVideoFeature },
          };
          const [rows, count] = await Promise.all([
            prisma.processedVideo.findMany({
              where,
              orderBy: { createdAt: "desc" },
              skip,
              take: limit,
              include: {
                processedAsset: true,
              },
            }),
            prisma.processedVideo.count({ where }),
          ]);
          totalCount = count;
          items = rows.map((video) => ({
            id: video.id,
            category: "video",
            mediaType: "video",
            status: video.status,
            prompt: null,
            name: video.originalName,
            model: video.upscaleModel ?? video.watermarkRemovalModel ?? null,
            outputUrl: video.processedAsset?.url ?? null,
            thumbnailUrl: null,
            error: video.error,
            createdAt: video.createdAt,
            generationMode: processedVideoFeature,
          }));
        } else {
          const where: Prisma.GenerationWhereInput = {
            userId: user.id,
            ...(videoFeature ? { functionMode: videoFeature } : {}),
          };
          const [rows, count] = await Promise.all([
            prisma.generation.findMany({
              where,
              orderBy: { createdAt: "desc" },
              skip,
              take: limit,
              include: {
                outputAsset: true,
                thumbnailAsset: true,
              },
            }),
            prisma.generation.count({ where }),
          ]);
          totalCount = count;
          items = rows.map((g) => ({
            id: g.id,
            category: "video",
            mediaType: "video",
            status: g.status,
            prompt: g.prompt,
            name: null,
            model: g.model,
            outputUrl: g.outputAsset?.url ?? null,
            thumbnailUrl: g.thumbnailAsset?.url ?? null,
            error: g.error,
            createdAt: g.createdAt,
            duration: g.duration,
            ratio: g.ratio,
            generationMode: g.functionMode ?? null,
          }));
        }
      } else if (type === "image") {
        const where: Prisma.ImageGenerationWhereInput = {
          userId: user.id,
          ...(imageFeature ? { type: imageFeature } : {}),
        };
        const [rows, count] = await Promise.all([
          prisma.imageGeneration.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            include: {
              outputAsset: true,
              thumbnailAsset: true,
            },
          }),
          prisma.imageGeneration.count({
            where,
          }),
        ]);
        totalCount = count;
        items = rows.map((g) => ({
          id: g.id,
          category: "image",
          mediaType: "image",
          status: g.status,
          prompt: g.prompt,
          name: null,
          model: g.model,
          outputUrl: g.outputAsset?.url ?? null,
          thumbnailUrl: g.thumbnailAsset?.url ?? null,
          error: g.error,
          createdAt: g.createdAt,
          ratio: g.ratio,
          resolution: g.resolution,
          imageGenerationType: g.type ?? null,
        }));
      } else {
        const [rows, count] = await Promise.all([
          prisma.asset.findMany({
            where: { userId: user.id, source: "UPLOAD" },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          prisma.asset.count({
            where: { userId: user.id, source: "UPLOAD" },
          }),
        ]);
        totalCount = count;
        items = rows.map((a) => ({
          id: a.id,
          category: "uploaded",
          mediaType:
            a.type === "VIDEO"
              ? "video"
              : a.type === "AUDIO"
                ? "audio"
                : "image",
          status: "COMPLETED",
          prompt: null,
          name: a.name,
          model: null,
          outputUrl: a.url,
          thumbnailUrl: null,
          createdAt: a.createdAt,
        }));
      }

      const totalPages = Math.ceil(totalCount / limit);

      return res.json({
        success: true,
        items,
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
      console.error("Error browsing assets:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to browse assets" });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(req.query.limit as string) || 20)
      );
      const skip = (page - 1) * limit;

      const sourceFilter = req.query.source as string | undefined;
      const where: Record<string, unknown> = { userId: user.id };
      if (sourceFilter) {
        where.source = sourceFilter;
      }

      const [assets, totalCount] = await Promise.all([
        prisma.asset.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.asset.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      res.status(200).json({
        success: true,
        assets,
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
      console.error("Error fetching uploaded assets:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch uploaded assets" });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const {
        name,
        url,
        mimeType,
        type,
        fileSize,
        width,
        height,
        duration,
        folderId,
      } = req.body;

      if (!name || !url || !mimeType || !type) {
        return res
          .status(400)
          .json({ success: false, error: "Missing required fields" });
      }

      // Optional: file the upload straight into one of the user's folders.
      let targetFolderId: string | null = null;
      if (folderId) {
        const folder = await findUserFolder(user.id, folderId);
        if (!folder) {
          return res
            .status(404)
            .json({ success: false, error: "Folder not found" });
        }
        targetFolderId = folder.id;
      }

      const asset = await prisma.asset.create({
        data: {
          userId: user.id,
          name,
          url,
          mimeType,
          type,
          source: "UPLOAD",
          fileSize: fileSize ? BigInt(fileSize) : null,
          width: width ?? null,
          height: height ?? null,
          duration: duration ?? null,
          folderId: targetFolderId,
        },
      });

      res.status(201).json({
        success: true,
        asset,
        item: uploadAssetToLibraryItem(asset),
      });
    } catch (error) {
      console.error("Error creating uploaded asset:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to create uploaded asset" });
    }
  }

  /**
   * PATCH /api/assets/:id { name?, folderId? }
   * Renames an asset and/or moves it to a folder (`folderId: null` unfiles
   * it). Works for uploads and for generation outputs (by output asset id).
   */
  async update(req: Request, res: Response) {
    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: req.auth.userId },
        select: { id: true },
      });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const existing = await prisma.asset.findFirst({
        where: { id: req.params.id, userId: user.id },
        select: { id: true },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, error: "Asset not found" });
      }

      const body = (req.body ?? {}) as { name?: unknown; folderId?: unknown };
      const data: Prisma.AssetUncheckedUpdateInput = {};

      if (body.name !== undefined) {
        const name =
          typeof body.name === "string"
            ? body.name.replace(/[\u0000-\u001f\u007f]/g, "").trim()
            : "";
        if (!name || name.length > 200) {
          return res.status(400).json({
            success: false,
            error: "Names need 1 to 200 characters.",
          });
        }
        data.name = name;
      }

      if (body.folderId !== undefined) {
        if (body.folderId === null) {
          data.folderId = null;
        } else {
          const folder = await findUserFolder(user.id, body.folderId);
          if (!folder) {
            return res
              .status(404)
              .json({ success: false, error: "Folder not found" });
          }
          data.folderId = folder.id;
        }
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({
          success: false,
          error: "Nothing to update. Send a name or a folderId.",
        });
      }

      const asset = await prisma.asset.update({
        where: { id: existing.id },
        data,
      });

      return res.json({
        success: true,
        data: {
          id: asset.id,
          name: asset.name,
          folderId: asset.folderId,
          item:
            asset.source === "UPLOAD" ? uploadAssetToLibraryItem(asset) : null,
        },
      });
    } catch (error) {
      console.error("Error updating asset:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to update the file" });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const { id } = req.params;

      const existing = await prisma.asset.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, error: "Asset not found" });
      }

      await prisma.asset.delete({ where: { id } });

      res
        .status(200)
        .json({ success: true, message: "Asset deleted successfully" });
    } catch (error) {
      console.error("Error deleting uploaded asset:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to delete uploaded asset" });
    }
  }
}
