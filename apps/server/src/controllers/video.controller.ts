import { Request, Response } from "express";
import prisma from "../lib/db";
import { addVideoProcessingBatch } from "../queue/video-process.queue";
import { createAsset } from "../lib/asset-utils";
import {
  consumeCredits,
  getCreditBalance,
  InsufficientCreditsError,
} from "../lib/credits";
import { DURATION_TOLERANCE_SECONDS, measureMediaSeconds } from "../lib/media-limits";

/** Longest video watermark/subtitle removal takes (matches the app's limit). */
const MAX_PROCESS_SECONDS = 120;

export class VideoController {
  async processVideo(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId; // From auth middleware

      const { videos, operations } = req.body;

      if (!videos || !Array.isArray(videos) || videos.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Videos array is required",
        });
      }

      if (!operations || operations.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Operations are required",
        });
      }

      // Validate each video has required fields
      for (const video of videos) {
        if (!video.videoUrl || !video.originalName) {
          return res.status(400).json({
            success: false,
            error: "Each video must have videoUrl and originalName",
          });
        }
      }

      // Check if API key is configured
      if (!process.env.WAVESPEED_API_KEY) {
        return res.status(500).json({
          success: false,
          error:
            "Wavespeed API key is not configured. Please add WAVESPEED_API_KEY to your environment variables.",
        });
      }

      // Priced per started 10 seconds per operation, from each video's real
      // length (measured here; a client-sent duration is never trusted).
      const durations = await Promise.all(
        videos.map((v: any) => measureMediaSeconds(String(v.videoUrl))),
      );
      for (const [i, dur] of durations.entries()) {
        if (!dur) {
          return res.status(400).json({
            success: false,
            error: `Couldn't read the length of "${videos[i].originalName}". Upload an MP4, WebM or MOV file.`,
          });
        }
        if (dur > MAX_PROCESS_SECONDS + DURATION_TOLERANCE_SECONDS) {
          return res.status(400).json({
            success: false,
            error: `"${videos[i].originalName}" is longer than ${MAX_PROCESS_SECONDS / 60} minutes.`,
          });
        }
      }
      const creditsPerVideoMap: number[] = durations.map(
        (dur) => Math.ceil((dur as number) / 10) * 10 * operations.length,
      );
      const totalCreditsNeeded = creditsPerVideoMap.reduce(
        (sum: number, c: number) => sum + c,
        0,
      );

      // Check if user has enough credits
      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const balance = await getCreditBalance(user.id);
      if (balance < totalCreditsNeeded) {
        return res.status(402).json({
          success: false,
          error: `Insufficient credits. Need ${totalCreditsNeeded}, have ${balance}`,
          creditsRemaining: balance,
        });
      }

      // Convert operations to Prisma enum format for database
      const prismaOperations = operations.map((op: string) => {
        if (op === "watermark_removal") return "WATERMARK_REMOVAL";
        if (op === "upscaling") return "UPSCALING";
        throw new Error(`Invalid operation: ${op}`);
      });

      // Create database records for each video first
      const videoRecords = await Promise.all(
        videos.map(async (video: any, index: number) => {
          const originalAsset = await createAsset({
            userId: user.id,
            url: video.videoUrl,
            name: video.originalName || "Original video",
            type: "VIDEO",
            source: "UPLOAD",
          });
          const processedVideo = await prisma.processedVideo.create({
            data: {
              userId: user.id,
              originalName: video.originalName || video.spcli,
              originalAssetId: originalAsset.id,
              operations: prismaOperations,
              creditsUsed: creditsPerVideoMap[index],
              status: "queued",
            },
          });
          return {
            ...video,
            dbVideoId: processedVideo.id,
          };
        }),
      );

      // Atomically consume credits per video so each job gets its own
      // refundable transaction id. If any single consume fails, refund what
      // we've already taken and bail.
      const perVideoCredits: Array<{ creditsUsed: number; creditTransactionId: string }> = [];
      let creditsRemaining: number | undefined;
      try {
        for (let i = 0; i < videoRecords.length; i++) {
          const amount = creditsPerVideoMap[i];
          const txn = await consumeCredits({
            userId: user.id,
            amount,
            reason: "video.processing",
            metadata: {
              processedVideoId: videoRecords[i].dbVideoId,
              operations,
            },
          });
          perVideoCredits.push({
            creditsUsed: amount,
            creditTransactionId: txn.transactionId,
          });
          creditsRemaining = txn.balanceAfter;
        }
      } catch (err) {
        // Roll back any prior consumption + delete pending records.
        const { refundConsumption } = await import("../lib/credits");
        let lastBalance: number | undefined;
        for (const c of perVideoCredits) {
          const refund = await refundConsumption(
            c.creditTransactionId,
            "video.processing.batch.aborted",
          ).catch(() => undefined);
          if (refund?.balanceAfter !== undefined) lastBalance = refund.balanceAfter;
        }
        await prisma.processedVideo
          .deleteMany({
            where: { id: { in: videoRecords.map((v: any) => v.dbVideoId) } },
          })
          .catch(() => {});

        if (err instanceof InsufficientCreditsError) {
          return res.status(402).json({
            success: false,
            error: err.message,
            creditsRemaining: lastBalance ?? err.available,
          });
        }
        throw err;
      }

      // Create individual jobs for each video with database record IDs
      const batch = await addVideoProcessingBatch(
        videos[0].method || "upload",
        videoRecords,
        user.id,
        operations,
        perVideoCredits,
      );

      return res.json({
        success: true,
        jobIds: batch.jobIds.map((id) => id?.toString()),
        // ProcessedVideo ids — what status polling (and the public API) uses.
        videoIds: videoRecords.map((v: any) => v.dbVideoId),
        message: `${videos.length} video processing jobs created successfully. ${totalCreditsNeeded} credits have been deducted.`,
        estimatedTime: `${videos.length * 2}-${videos.length * 5} minutes`,
        videosCount: videos.length,
        operations,
        creditsDeducted: totalCreditsNeeded,
        creditsRemaining,
      });
    } catch (error) {
      console.error("Video processing job creation error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async getVideos(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      // Get pagination parameters from query
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 12;
      const offset = (page - 1) * limit;
      const operation = req.query.operation as string | undefined;

      // Validate pagination parameters
      if (page < 1) {
        return res.status(400).json({
          success: false,
          error: "Page must be greater than 0",
        });
      }

      if (limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          error: "Limit must be between 1 and 100",
        });
      }

      // Get user to verify access
      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const where: Record<string, unknown> = { userId: user.id };
      if (operation) {
        where.operations = { has: operation };
      }

      // Get total count for pagination
      const totalCount = await prisma.processedVideo.count({ where });

      // Get paginated videos for the user, ordered by most recent first
      const videos = await prisma.processedVideo.findMany({
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
          durationSeconds: true,
          fileSizeBytes: true,
          upscaleModel: true,
          watermarkRemovalModel: true,
          createdAt: true,
          updatedAt: true,
        },
      });

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
      console.error("Get videos error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async refreshVideoStatus(req: Request, res: Response) {
    try {
      const { videoId } = req.params;
      const clerkUserId = req.auth.userId;

      if (!videoId) {
        return res.status(400).json({
          success: false,
          error: "Video ID is required",
        });
      }

      // Get user to verify access
      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Get the video record and verify ownership
      const video = await prisma.processedVideo.findFirst({
        where: {
          id: videoId,
          userId: user.id,
        },
        select: {
          id: true,
          originalName: true,
          originalAsset: true,
          processedAsset: true,
          operations: true,
          creditsUsed: true,
          status: true,
          error: true,
          durationSeconds: true,
          fileSizeBytes: true,
          upscaleModel: true,
          watermarkRemovalModel: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!video) {
        return res.status(404).json({
          success: false,
          error: "Video not found or access denied",
        });
      }

      return res.json({
        success: true,
        video,
      });
    } catch (error) {
      console.error("Refresh video status error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async deleteVideo(req: Request, res: Response) {
    try {
      const { videoId } = req.params;
      const clerkUserId = req.auth.userId;

      if (!videoId) {
        return res.status(400).json({
          success: false,
          error: "Video ID is required",
        });
      }

      // Get user to verify access
      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Delete the video record if it belongs to the user
      const deletedVideo = await prisma.processedVideo.delete({
        where: {
          id: videoId,
          userId: user.id,
        },
      });

      return res.json({
        success: true,
        message: "Video deleted successfully",
      });
    } catch (error) {
      console.error("Delete video error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async deleteVideos(req: Request, res: Response) {
    try {
      const { videoIds } = req.body;
      const clerkUserId = req.auth.userId;

      if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Video IDs array is required",
        });
      }

      // Get user to verify access
      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Delete the video records if they belong to the user
      const deletedVideos = await prisma.processedVideo.deleteMany({
        where: {
          id: { in: videoIds },
          userId: user.id,
        },
      });

      return res.json({
        success: true,
        message: "Videos deleted successfully",
        count: deletedVideos.count,
      });
    } catch (error) {
      console.error("Delete videos error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
}
