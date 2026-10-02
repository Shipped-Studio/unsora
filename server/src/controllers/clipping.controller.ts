import { Request, Response } from "express";
import prisma from "../lib/db";
import { addClippingJob } from "../queue/clipping.queue";
import {
  resolveTargetDuration,
  resolveClipLimit,
  resolveClipRatio,
  resolveMomentsQuery,
  refreshClippingFromWayin,
} from "../lib/clipping-utils";
import { resolveCaptionSettings } from "../lib/caption-styles";
import { WayinAPI } from "../lib/wayin-api";
import { calculateClippingCredits } from "../lib/clipping-pricing";
import { resolveClippingVideoDuration } from "../lib/clipping-video-info";
import {
  consumeCredits,
  getCreditBalance,
  InsufficientCreditsError,
} from "../lib/credits";

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

function normalizeVideoUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export class ClippingController {
  async create(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const {
        videoUrl,
        sourceLang,
        targetLang,
        targetDuration,
        query,
        limit,
        enableCaption,
        captionStyle,
        ratio,
      } = req.body;

      const normalizedUrl = normalizeVideoUrl(
        typeof videoUrl === "string" ? videoUrl : "",
      );
      if (!normalizedUrl) {
        return res
          .status(400)
          .json({ success: false, error: "videoUrl is required" });
      }

      const resolvedDuration = resolveTargetDuration(targetDuration);
      if (!resolvedDuration) {
        return res.status(400).json({
          success: false,
          error: "Invalid targetDuration",
        });
      }

      const { limit: resolvedLimit, error: limitError } =
        resolveClipLimit(limit);
      if (limitError) {
        return res.status(400).json({
          success: false,
          error: limitError,
        });
      }

      const {
        enableCaption: resolvedEnableCaption,
        captionStyle: resolvedCaptionStyle,
        error: captionError,
      } = resolveCaptionSettings({ enableCaption, captionStyle });
      if (captionError) {
        return res.status(400).json({
          success: false,
          error: captionError,
        });
      }

      const { ratio: resolvedRatio, error: ratioError } =
        resolveClipRatio(ratio);
      if (ratioError) {
        return res.status(400).json({
          success: false,
          error: ratioError,
        });
      }

      const { query: resolvedQuery, error: queryError } =
        resolveMomentsQuery(query);
      if (queryError) {
        return res.status(400).json({
          success: false,
          error: queryError,
        });
      }

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const durationSeconds = await resolveClippingVideoDuration(normalizedUrl);
      if (durationSeconds == null) {
        return res.status(400).json({
          success: false,
          error: "Unable to determine video length",
        });
      }

      const creditsRequired = calculateClippingCredits(durationSeconds);
      if (creditsRequired <= 0) {
        return res.status(400).json({
          success: false,
          error: "Unable to compute clipping cost",
        });
      }

      const balance = await getCreditBalance(user.id);
      if (balance < creditsRequired) {
        return res.status(402).json({
          success: false,
          error: `Insufficient credits. Need ${creditsRequired}, have ${balance}`,
          creditsRemaining: balance,
        });
      }

      const config = {
        sourceLang: sourceLang ?? null,
        targetLang: targetLang ?? null,
        targetDuration: resolvedDuration,
        query: resolvedQuery,
        limit: resolvedLimit,
        enableCaption: resolvedEnableCaption,
        captionStyle: resolvedCaptionStyle,
        ratio: resolvedRatio,
      };

      const clipping = await prisma.aIClipping.create({
        data: {
          userId: user.id,
          videoUrl: normalizedUrl,
          config,
          status: "QUEUED",
          creditsUsed: creditsRequired,
          metadata: { durationSeconds },
        },
      });

      let creditTransactionId: string;
      let creditsRemaining: number;
      try {
        const consumption = await consumeCredits({
          userId: user.id,
          amount: creditsRequired,
          reason: "ai.clipping",
          metadata: {
            clippingId: clipping.id,
            durationSeconds,
            videoUrl: normalizedUrl,
          },
        });
        creditTransactionId = consumption.transactionId;
        creditsRemaining = consumption.balanceAfter;
      } catch (err) {
        await prisma.aIClipping
          .delete({ where: { id: clipping.id } })
          .catch(() => {});
        if (err instanceof InsufficientCreditsError) {
          return res.status(402).json({
            success: false,
            error: err.message,
            creditsRemaining: err.available,
          });
        }
        throw err;
      }

      await addClippingJob({
        userId: user.id,
        clippingId: clipping.id,
        videoUrl: normalizedUrl,
        sourceLang: sourceLang ?? null,
        targetLang: targetLang ?? null,
        targetDuration: resolvedDuration,
        query: resolvedQuery,
        limit: resolvedLimit,
        enableCaption: resolvedEnableCaption,
        captionStyle: resolvedCaptionStyle,
        ratio: resolvedRatio,
        creditsUsed: creditsRequired,
        creditTransactionId,
      });

      res.status(201).json({
        success: true,
        data: {
          id: clipping.id,
          status: clipping.status,
          videoUrl: normalizedUrl,
          config,
          createdAt: clipping.createdAt,
          clips: [],
          creditsUsed: creditsRequired,
        },
        creditsDeducted: creditsRequired,
        creditsRemaining,
      });
    } catch (error) {
      console.error("Error creating clipping job:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create clipping job",
      });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const clippings = await prisma.aIClipping.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: {
          clips: {
            orderBy: { order: "asc" },
            include: {
              outputAsset: true,
              thumbnailAsset: true,
            },
          },
        },
      });

      res.json({ success: true, data: clippings });
    } catch (error) {
      console.error("Error fetching clippings:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch clippings",
      });
    }
  }

  async refresh(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const { clippingId } = req.params;
      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const clipping = await prisma.aIClipping.findFirst({
        where: { id: clippingId, userId: user.id },
        include: {
          clips: {
            orderBy: { order: "asc" },
            include: {
              outputAsset: true,
              thumbnailAsset: true,
            },
          },
        },
      });

      if (!clipping) {
        return res
          .status(404)
          .json({ success: false, error: "Clipping job not found" });
      }

      if (!clipping.taskId || clipping.status === "COMPLETED") {
        return res.json({ success: true, data: clipping });
      }

      const apiKey = process.env.WAYIN_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: "WAYIN_API_KEY is not configured",
        });
      }

      const client = new WayinAPI(apiKey);
      const refreshed = await refreshClippingFromWayin(client, clipping);

      const updated = await prisma.aIClipping.update({
        where: { id: clipping.id },
        data: refreshed,
        include: {
          clips: {
            orderBy: { order: "asc" },
            include: {
              outputAsset: true,
              thumbnailAsset: true,
            },
          },
        },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      console.error("Error refreshing clipping job:", error);
      res.status(500).json({
        success: false,
        error: "Failed to refresh clipping job",
      });
    }
  }

  async deleteJob(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const { clippingId } = req.params;
      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const clipping = await prisma.aIClipping.findFirst({
        where: { id: clippingId, userId: user.id },
        select: { id: true },
      });

      if (!clipping) {
        return res
          .status(404)
          .json({ success: false, error: "Clipping job not found" });
      }

      await prisma.aIClipping.delete({ where: { id: clippingId } });

      res.json({ success: true, message: "Clipping job deleted" });
    } catch (error) {
      console.error("Error deleting clipping job:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete clipping job",
      });
    }
  }

  async deleteClip(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const { clippingId, clipId } = req.params;
      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const clip = await prisma.aIClippingClip.findFirst({
        where: {
          id: clipId,
          aiClippingId: clippingId,
          aiClipping: { userId: user.id },
        },
        select: { id: true },
      });

      if (!clip) {
        return res
          .status(404)
          .json({ success: false, error: "Clip not found" });
      }

      await prisma.aIClippingClip.delete({ where: { id: clipId } });

      res.json({ success: true, message: "Clip deleted" });
    } catch (error) {
      console.error("Error deleting clip:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete clip",
      });
    }
  }
}
