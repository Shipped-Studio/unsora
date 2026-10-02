import { Request, Response } from "express";
import prisma from "../../../lib/db";
import { addClippingJob } from "../../../queue/clipping.queue";
import {
  resolveTargetDuration,
  resolveClipLimit,
  resolveClipRatio,
  resolveMomentsQuery,
  refreshClippingFromWayin,
} from "../../../lib/clipping-utils";
import { resolveCaptionSettings } from "../../../lib/caption-styles";
import { WayinAPI } from "../../../lib/wayin-api";
import { calculateClippingCredits } from "../../../lib/clipping-pricing";
import { resolveClippingVideoDuration } from "../../../lib/clipping-video-info";
import {
  consumeCredits,
  getCreditBalance,
  InsufficientCreditsError,
} from "../../../lib/credits";
import { getApiKeyId, mergeApiContext } from "../../../lib/api-public";
import { withPublicCreate } from "../helpers/public-create";
import { handlePublicError } from "../helpers/public-response";

const clippingInclude = {
  clips: {
    orderBy: { order: "asc" as const },
    include: {
      outputAsset: true,
      thumbnailAsset: true,
    },
  },
};

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

type CreateResult =
  | { ok: false; status: number; body: Record<string, unknown> }
  | { ok: true; body: Record<string, unknown> };

export class PublicClippingController {
  create = async (req: Request, res: Response) => {
    try {
      await withPublicCreate(req, res, 201, async () => {
        const result = await this.runCreate(req);
        if (!result.ok) {
          res.status(result.status).json(result.body);
          return null;
        }
        return result.body;
      });
    } catch (error) {
      console.error("Public create clipping error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Internal server error",
        });
      }
    }
  };

  getAll = async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req.auth.userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const clippings = await prisma.aIClipping.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: clippingInclude,
      });

      res.json({ success: true, data: clippings });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Error fetching clippings:",
        "Failed to fetch clippings",
      );
    }
  };

  getOne = async (req: Request, res: Response) => {
    try {
      const { clippingId } = req.params;
      if (!clippingId) {
        return res
          .status(400)
          .json({ success: false, error: "Clipping ID is required" });
      }

      const user = await resolveUser(req.auth.userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const clipping = await prisma.aIClipping.findFirst({
        where: { id: clippingId, userId: user.id },
        include: clippingInclude,
      });

      if (!clipping) {
        return res
          .status(404)
          .json({ success: false, error: "Clipping job not found" });
      }

      res.json({ success: true, data: clipping });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Error fetching clipping job:",
        "Failed to fetch clipping job",
      );
    }
  };

  refresh = async (req: Request, res: Response) => {
    try {
      const { clippingId } = req.params;
      const user = await resolveUser(req.auth.userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const clipping = await prisma.aIClipping.findFirst({
        where: { id: clippingId, userId: user.id },
        include: clippingInclude,
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
        include: clippingInclude,
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Error refreshing clipping job:",
        "Failed to refresh clipping job",
      );
    }
  };

  deleteJob = async (req: Request, res: Response) => {
    try {
      const { clippingId } = req.params;
      const user = await resolveUser(req.auth.userId);
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
  };

  deleteClip = async (req: Request, res: Response) => {
    try {
      const { clippingId, clipId } = req.params;
      const user = await resolveUser(req.auth.userId);
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
  };

  private async runCreate(req: Request): Promise<CreateResult> {
    const apiKeyId = getApiKeyId(req);

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
      return {
        ok: false,
        status: 400,
        body: { success: false, error: "videoUrl is required" },
      };
    }

    const resolvedDuration = resolveTargetDuration(targetDuration);
    if (!resolvedDuration) {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: "Invalid targetDuration" },
      };
    }

    const { limit: resolvedLimit, error: limitError } = resolveClipLimit(limit);
    if (limitError) {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: limitError },
      };
    }

    const {
      enableCaption: resolvedEnableCaption,
      captionStyle: resolvedCaptionStyle,
      error: captionError,
    } = resolveCaptionSettings({ enableCaption, captionStyle });
    if (captionError) {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: captionError },
      };
    }

    const { ratio: resolvedRatio, error: ratioError } = resolveClipRatio(ratio);
    if (ratioError) {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: ratioError },
      };
    }

    const { query: resolvedQuery, error: queryError } =
      resolveMomentsQuery(query);
    if (queryError) {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: queryError },
      };
    }

    const user = await resolveUser(req.auth.userId);
    if (!user) {
      return {
        ok: false,
        status: 404,
        body: { success: false, error: "User not found" },
      };
    }

    const durationSeconds = await resolveClippingVideoDuration(normalizedUrl);
    if (durationSeconds == null) {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: "Unable to determine video length" },
      };
    }

    const creditsRequired = calculateClippingCredits(durationSeconds);
    if (creditsRequired <= 0) {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: "Unable to compute clipping cost" },
      };
    }

    const balance = await getCreditBalance(user.id);
    if (balance < creditsRequired) {
      return {
        ok: false,
        status: 402,
        body: {
          success: false,
          error: `Insufficient credits. Need ${creditsRequired}, have ${balance}`,
          creditsRemaining: balance,
        },
      };
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

    const metadata = mergeApiContext(
      { durationSeconds },
      { apiKeyId },
    );

    const clipping = await prisma.aIClipping.create({
      data: {
        userId: user.id,
        videoUrl: normalizedUrl,
        config,
        status: "QUEUED",
        creditsUsed: creditsRequired,
        metadata,
      },
    });

    let creditTransactionId: string;
    let creditsRemaining: number;
    try {
      const consumption = await consumeCredits({
        userId: user.id,
        amount: creditsRequired,
        reason: "ai.clipping",
        apiKeyId,
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
        return {
          ok: false,
          status: 402,
          body: {
            success: false,
            error: err.message,
            creditsRemaining: err.available,
          },
        };
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

    return {
      ok: true,
      body: {
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
      },
    };
  }
}
