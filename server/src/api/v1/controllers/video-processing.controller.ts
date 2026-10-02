import { Request, Response } from "express";
import prisma from "../../../lib/db";
import { VideoController } from "../../../controllers/video.controller";
import { VideoUpscalerController } from "../../../controllers/video-upscaler.controller";
import { probeDurationSeconds } from "../helpers/media-duration";
import { handlePublicError, sendError } from "../helpers/public-response";
import { resolveUser } from "../helpers/resolve-user";

const videoController = new VideoController();
const videoUpscalerController = new VideoUpscalerController();

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function fileNameFromUrl(url: string): string {
  try {
    const base = new URL(url).pathname.split("/").pop();
    if (base) return decodeURIComponent(base);
  } catch {
    // fall through
  }
  return "video";
}

/**
 * Processed-video jobs (upscaling, subtitle/watermark removal). Both delegate
 * to the app controllers, which price by the video's duration — so it is
 * measured here instead of trusted from the caller. Jobs poll via
 * GET /video/status/:id.
 */
export class PublicVideoProcessingController {
  /** POST /video-upscaler/create — `{ videoUrl, model? }` */
  createUpscale = async (req: Request, res: Response) => {
    try {
      const { videoUrl, model } = req.body ?? {};
      if (!isHttpUrl(videoUrl)) {
        return sendError(res, 400, "videoUrl must be a public http(s) video file URL");
      }

      // Unreadable duration → the app controller's default, which prices at
      // the top tier, so an unknown length is never undercharged.
      const duration = await probeDurationSeconds(videoUrl);
      req.body = {
        videoUrl,
        model,
        originalName: fileNameFromUrl(videoUrl),
        ...(duration ? { duration } : {}),
      };
      return videoUpscalerController.create(req, res);
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Public create video upscale error:",
        "Failed to start video upscale",
      );
    }
  };

  /** POST /watermark-removal/create — `{ videoUrl, name? }` */
  createWatermarkRemoval = async (req: Request, res: Response) => {
    try {
      const { videoUrl, name } = req.body ?? {};
      if (!isHttpUrl(videoUrl)) {
        return sendError(res, 400, "videoUrl must be a public http(s) video file URL");
      }

      // No safe fallback here: without a duration the app controller charges
      // a flat minimum regardless of length.
      const durationSeconds = await probeDurationSeconds(videoUrl);
      if (!durationSeconds) {
        return sendError(
          res,
          400,
          "Could not read the video's duration. Pass a direct video file URL " +
            "(e.g. .mp4) — upload it with POST /uploads first if needed.",
        );
      }

      const originalName =
        typeof name === "string" && name.trim()
          ? name.trim()
          : fileNameFromUrl(videoUrl);

      req.body = {
        videos: [{ videoUrl, originalName, method: "url", durationSeconds }],
        operations: ["watermark_removal"],
      };
      return videoController.processVideo(req, res);
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Public create watermark removal error:",
        "Failed to start watermark removal",
      );
    }
  };

  /** GET /watermark-removal/all */
  getWatermarkRemovals = async (req: Request, res: Response) => {
    try {
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const limit = Math.min(
        Math.max(parseInt(req.query.limit as string) || 12, 1),
        100,
      );

      const user = await resolveUser(req.auth.userId);
      if (!user) return sendError(res, 404, "User not found");

      const where = {
        userId: user.id,
        operations: { has: "WATERMARK_REMOVAL" as const },
      };

      const [videos, totalCount] = await Promise.all([
        prisma.processedVideo.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            originalName: true,
            originalAsset: true,
            processedAsset: true,
            creditsUsed: true,
            status: true,
            error: true,
            durationSeconds: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.processedVideo.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return res.json({
        success: true,
        videos,
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
      return handlePublicError(
        res,
        error,
        "Public list watermark removals error:",
        "Failed to list watermark removals",
      );
    }
  };
}
