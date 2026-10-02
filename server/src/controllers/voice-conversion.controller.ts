import { Request, Response } from "express";
import prisma from "../lib/db";
import { addVoiceConversionJob } from "../queue/voice-conversion.queue";
import { createAsset } from "../lib/asset-utils";
import {
  consumeCredits,
  getCreditBalance,
  InsufficientCreditsError,
} from "../lib/credits";
import { resolveVoiceCloneForUser } from "../lib/voice-resolver";
import { isElevenLabsConfigured, MAX_STS_AUDIO_SECONDS } from "../lib/elevenlabs-api";
import {
  downloadAudioToTemp,
  getAudioDurationSeconds,
  voiceConversionCredits,
  cleanupTempFiles,
} from "../lib/audio-mix";

const VALID_OUTPUT_FORMATS = ["mp3", "wav"] as const;

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

export class VoiceConversionController {
  async createConversion(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const {
        voice_id: voiceId,
        source_url: sourceUrl,
        source_asset_id: sourceAssetId,
        output_format: outputFormat = "mp3",
      } = req.body;

      if (!isElevenLabsConfigured()) {
        return res.status(503).json({
          success: false,
          error: "Voice conversion is not configured",
        });
      }

      if (!voiceId || typeof voiceId !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "voice_id is required" });
      }

      if (!VALID_OUTPUT_FORMATS.includes(outputFormat)) {
        return res.status(400).json({
          success: false,
          error: `Invalid output_format. Must be one of: ${VALID_OUTPUT_FORMATS.join(", ")}`,
        });
      }

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const resolvedVoice = await resolveVoiceCloneForUser(user.id, voiceId);
      if (!resolvedVoice?.elevenLabsVoiceId) {
        return res.status(400).json({
          success: false,
          error: "Invalid voice clone — only cloned voices can be used",
        });
      }

      let resolvedSourceUrl =
        typeof sourceUrl === "string" ? sourceUrl.trim() : "";
      let resolvedSourceAssetId: string | undefined;

      if (sourceAssetId) {
        const asset = await prisma.asset.findFirst({
          where: {
            id: sourceAssetId,
            userId: user.id,
            type: { in: ["AUDIO", "VIDEO"] },
          },
        });
        if (!asset) {
          return res.status(400).json({
            success: false,
            error: "Invalid source asset",
          });
        }
        resolvedSourceUrl = asset.url;
        resolvedSourceAssetId = asset.id;
      }

      if (!resolvedSourceUrl) {
        return res.status(400).json({
          success: false,
          error: "source_url or source_asset_id is required",
        });
      }

      const tempPath = await downloadAudioToTemp(
        resolvedSourceUrl,
        `voice-conv-check-${Date.now()}.mp3`,
      );

      let creditCost: number;
      try {
        const duration = await getAudioDurationSeconds(tempPath);
        if (duration > MAX_STS_AUDIO_SECONDS) {
          return res.status(400).json({
            success: false,
            error: `Audio must be at most ${MAX_STS_AUDIO_SECONDS / 60} minutes`,
          });
        }
        creditCost = voiceConversionCredits(duration);
      } finally {
        cleanupTempFiles(tempPath);
      }

      const balance = await getCreditBalance(user.id);
      if (balance < creditCost) {
        return res.status(402).json({
          success: false,
          error: `Insufficient credits. Need ${creditCost}, have ${balance}`,
          creditsRemaining: balance,
        });
      }

      if (!resolvedSourceAssetId) {
        const sourceAsset = await createAsset({
          userId: user.id,
          url: resolvedSourceUrl,
          name: "Voice conversion source",
          type: "AUDIO",
          source: "UPLOAD",
        });
        resolvedSourceAssetId = sourceAsset.id;
      }

      const conversion = await prisma.voiceConversion.create({
        data: {
          userId: user.id,
          voiceId: resolvedVoice.voiceId,
          elevenLabsVoiceId: resolvedVoice.elevenLabsVoiceId,
          outputFormat,
          sourceAssetId: resolvedSourceAssetId,
          creditsUsed: creditCost,
          status: "QUEUED",
        },
      });

      let creditTransactionId: string;
      let creditsRemaining: number;
      try {
        const consumption = await consumeCredits({
          userId: user.id,
          amount: creditCost,
          reason: "voice.conversion",
          metadata: { conversionId: conversion.id },
        });
        creditTransactionId = consumption.transactionId;
        creditsRemaining = consumption.balanceAfter;
      } catch (err) {
        await prisma.voiceConversion
          .delete({ where: { id: conversion.id } })
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

      await addVoiceConversionJob({
        userId: user.id,
        conversionId: conversion.id,
        creditsUsed: creditCost,
        creditTransactionId,
        sourceUrl: resolvedSourceUrl,
        elevenLabsVoiceId: resolvedVoice.elevenLabsVoiceId,
        outputFormat,
      });

      return res.json({
        success: true,
        conversion: { id: conversion.id, status: "QUEUED" },
        creditsDeducted: creditCost,
        creditsRemaining,
      });
    } catch (error) {
      console.error("Create voice conversion error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async getConversions(req: Request, res: Response) {
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

      const [conversions, totalCount] = await Promise.all([
        prisma.voiceConversion.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          include: { outputAsset: true, sourceAsset: true },
        }),
        prisma.voiceConversion.count({ where: { userId: user.id } }),
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return res.json({
        success: true,
        conversions,
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
      console.error("Get voice conversions error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async refreshConversionStatus(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;
      const { conversionId } = req.params;

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const conversion = await prisma.voiceConversion.findFirst({
        where: { id: conversionId, userId: user.id },
        include: { outputAsset: true, sourceAsset: true },
      });

      if (!conversion) {
        return res
          .status(404)
          .json({ success: false, error: "Conversion not found" });
      }

      return res.json({ success: true, conversion });
    } catch (error) {
      console.error("Refresh voice conversion error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async deleteConversion(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;
      const { conversionId } = req.params;

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      await prisma.voiceConversion.delete({
        where: { id: conversionId, userId: user.id },
      });

      return res.json({ success: true, message: "Conversion deleted" });
    } catch (error) {
      console.error("Delete voice conversion error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
}
