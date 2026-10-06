import { Request, Response } from "express";
import {
  addRenderProcessingJob,
  getRenderJobStatus,
} from "../queue/render.queue";
import prisma from "../lib/db";
import { createAsset } from "../lib/asset-utils";
import {
  consumeCredits,
  getCreditBalance,
  InsufficientCreditsError,
} from "../lib/credits";
import { calculateRenderCredits } from "../lib/render-pricing";

const MAX_EXPORT_FPS = 60;
const MAX_EXPORT_SIDE = 4096;
const MAX_EXPORT_PIXELS = 4096 * 2160;

export class ExportController {
  async createExport(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const {
        transcriptionId,
        videoUrl,
        subtitleChunks,
        style,
        duration,
        fps = 30,
        width,
        height,
      } = req.body;

      if (!videoUrl || !subtitleChunks || !style || !duration) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields",
        });
      }

      if (typeof duration !== "number" || duration <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid video duration",
        });
      }

      // The price is per minute only, so keep the render itself bounded: up
      // to 60 fps and a 4K-sized frame.
      if (!Number.isInteger(fps) || fps < 1 || fps > MAX_EXPORT_FPS) {
        return res.status(400).json({
          success: false,
          error: `fps must be a whole number from 1 to ${MAX_EXPORT_FPS}`,
        });
      }
      for (const side of [width, height]) {
        if (
          side !== undefined &&
          (!Number.isInteger(side) || side < 16 || side > MAX_EXPORT_SIDE)
        ) {
          return res.status(400).json({
            success: false,
            error: `width and height must be whole numbers from 16 to ${MAX_EXPORT_SIDE}`,
          });
        }
      }
      if ((width ?? 1080) * (height ?? 1920) > MAX_EXPORT_PIXELS) {
        return res.status(400).json({
          success: false,
          error: "The export resolution is larger than 4K",
        });
      }

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // ---- Pricing (6 credits per started minute of rendered video) ----
      const creditsRequired = calculateRenderCredits(duration);
      if (creditsRequired <= 0) {
        return res.status(400).json({
          success: false,
          error: "Unable to compute export cost",
        });
      }

      const balance = await getCreditBalance(user.id);
      if (balance < creditsRequired) {
        return res.status(402).json({
          success: false,
          error: `Insufficient credits. This export needs ${creditsRequired} credits and you have ${balance}.`,
          data: {
            creditsRequired,
            creditsAvailable: balance,
          },
        });
      }

      const sourceAsset = await createAsset({
        userId: user.id,
        url: videoUrl,
        name: "Export source video",
        type: "VIDEO",
        source: "UPLOAD",
      });

      const videoExport = await prisma.videoExport.create({
        data: {
          userId: user.id,
          transcriptionId,
          sourceAssetId: sourceAsset.id,
          settings: style,
          duration,
          fps,
          width,
          height,
        },
      });

      // Consume credits AFTER we have an export id so the audit log can point
      // back at the row, but BEFORE the job is enqueued so a fast worker can't
      // race the deduction. If anything below fails we refund manually.
      let creditTransactionId: string | undefined;
      let creditsRemaining = balance;
      try {
        const consumption = await consumeCredits({
          userId: user.id,
          amount: creditsRequired,
          reason: "video.export.subtitle",
          metadata: {
            exportId: videoExport.id,
            transcriptionId: transcriptionId ?? null,
            durationSeconds: duration,
          },
        });
        creditTransactionId = consumption.transactionId;
        creditsRemaining = consumption.balanceAfter;
      } catch (err) {
        // Roll back the export row so a failed charge doesn't leave a ghost.
        await prisma.videoExport.delete({ where: { id: videoExport.id } });

        if (err instanceof InsufficientCreditsError) {
          return res.status(402).json({
            success: false,
            error: `Insufficient credits. This export needs ${err.required} credits and you have ${err.available}.`,
            data: {
              creditsRequired: err.required,
              creditsAvailable: err.available,
            },
          });
        }
        throw err;
      }

      const taskId = videoExport.taskId!;

      await addRenderProcessingJob(
        {
          userId: user.id,
          renderId: videoExport.id,
          subtitleChunks,
          creditsUsed: creditsRequired,
          creditTransactionId,
        },
        { jobId: taskId }
      );

      res.status(202).json({
        success: true,
        data: {
          taskId,
          message: "Export job queued successfully",
          creditsUsed: creditsRequired,
          creditsRemaining,
        },
      });
    } catch (error) {
      console.error("Error queueing export job:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to queue export job",
      });
    }
  }

  async getJobStatus(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const { taskId } = req.params;

      const jobStatus = await getRenderJobStatus(taskId);

      if (!jobStatus) {
        return res.status(404).json({
          success: false,
          error: "Job not found",
        });
      }

      res.status(200).json({
        success: true,
        data: {
          taskId: jobStatus.id,
          progress: jobStatus.progress,
          status: jobStatus.finishedOn
            ? "completed"
            : jobStatus.failedReason
            ? "failed"
            : "processing",
          processedOn: jobStatus.processedOn,
          finishedOn: jobStatus.finishedOn,
          failedReason: jobStatus.failedReason,
          result: jobStatus.returnvalue,
        },
      });
    } catch (error) {
      console.error("Error getting job status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get job status",
      });
    }
  }

  async getExport(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const videoExport = await prisma.videoExport.findFirst({
        where: {
          id,
          userId: user.id,
        },
        include: {
          sourceAsset: true,
          outputAsset: true,
        },
      });

      if (!videoExport) {
        return res.status(404).json({
          success: false,
          error: "Export not found",
        });
      }

      res.status(200).json({
        success: true,
        data: videoExport,
      });
    } catch (error) {
      console.error("Error getting export:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get export",
      });
    }
  }

  async getUserExports(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 12;
      const offset = (page - 1) * limit;

      if (page < 1 || limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          error: "Invalid pagination parameters",
        });
      }

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const totalCount = await prisma.videoExport.count({
        where: { userId: user.id },
      });

      const exports = await prisma.videoExport.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          sourceAsset: true,
          outputAsset: true,
          transcription: {
            select: {
              id: true,
              filename: true,
              language: true,
            },
          },
        },
        skip: offset,
        take: limit,
      });

      const totalPages = Math.ceil(totalCount / limit);

      res.status(200).json({
        success: true,
        data: exports,
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
      console.error("Error getting user exports:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get user exports",
      });
    }
  }

  async deleteExport(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const existing = await prisma.videoExport.findFirst({
        where: {
          id,
          userId: user.id,
        },
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: "Export not found",
        });
      }

      await prisma.videoExport.delete({
        where: { id },
      });

      res.status(200).json({
        success: true,
        message: "Export deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting export:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete export",
      });
    }
  }
}
