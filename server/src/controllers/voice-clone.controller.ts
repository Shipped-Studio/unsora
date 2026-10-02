import { Request, Response } from "express";
import prisma from "../lib/db";
import { createAsset } from "../lib/asset-utils";
import {
  getElevenLabsClient,
  isElevenLabsConfigured,
} from "../lib/elevenlabs-api";
import {
  consumeCredits,
  getCreditBalance,
  InsufficientCreditsError,
} from "../lib/credits";
import {
  MAX_VOICE_CLONES_PER_USER,
  VOICE_CLONE_CREDIT_COST,
  VOICE_PRESETS,
} from "../config/models";
import { downloadFromStorageUrl } from "../lib/supabase-storage";
import { listElevenV3Voices } from "../lib/voice-catalog";

const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 500;
const ALLOWED_SAMPLE_MIME = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
  "video/mp4",
];

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

function inferMimeType(url: string, assetMime?: string | null): string {
  if (assetMime && ALLOWED_SAMPLE_MIME.includes(assetMime)) {
    return assetMime;
  }

  const lower = url.toLowerCase();
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".webm")) return "audio/webm";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".mp4")) return "video/mp4";
  return "audio/mpeg";
}

function inferFileName(url: string, mimeType: string): string {
  try {
    const pathname = new URL(url).pathname;
    const base = pathname.split("/").pop();
    if (base && base.includes(".")) return base;
  } catch {
    // ignore
  }

  if (mimeType.includes("wav")) return "voice-sample.wav";
  if (mimeType.includes("webm")) return "voice-sample.webm";
  if (mimeType.includes("mp4")) return "voice-sample.mp4";
  return "voice-sample.mp3";
}

export class VoiceCloneController {
  /** GET /api/voice-clones/all — list user's cloned voices + preset catalog. */
  async listVoices(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;
      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const clones = await prisma.voiceClone.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { sampleAsset: true },
      });

      return res.json({
        success: true,
        presets: VOICE_PRESETS,
        elevenV3Voices: listElevenV3Voices(),
        clones,
        elevenLabsConfigured: isElevenLabsConfigured(),
        maxClones: MAX_VOICE_CLONES_PER_USER,
        cloneCreditCost: VOICE_CLONE_CREDIT_COST,
      });
    } catch (error) {
      console.error("List voice clones error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  /** POST /api/voice-clones/create */
  async createClone(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const {
        name,
        description,
        sample_asset_id: sampleAssetId,
        sample_url: sampleUrl,
      } = req.body;

      if (!isElevenLabsConfigured()) {
        return res.status(503).json({
          success: false,
          error: "Voice cloning is not configured",
        });
      }

      const nameText = typeof name === "string" ? name.trim() : "";
      if (!nameText) {
        return res
          .status(400)
          .json({ success: false, error: "Name is required" });
      }
      if (nameText.length > MAX_NAME_LENGTH) {
        return res.status(400).json({
          success: false,
          error: `Name must be at most ${MAX_NAME_LENGTH} characters`,
        });
      }

      const descriptionText =
        typeof description === "string" ? description.trim() : "";
      if (descriptionText.length > MAX_DESCRIPTION_LENGTH) {
        return res.status(400).json({
          success: false,
          error: `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`,
        });
      }

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const cloneCount = await prisma.voiceClone.count({
        where: { userId: user.id },
      });
      if (cloneCount >= MAX_VOICE_CLONES_PER_USER) {
        return res.status(400).json({
          success: false,
          error: `You can have at most ${MAX_VOICE_CLONES_PER_USER} cloned voices`,
        });
      }

      let resolvedSampleUrl = typeof sampleUrl === "string" ? sampleUrl.trim() : "";
      let resolvedSampleAssetId: string | undefined;

      if (sampleAssetId) {
        const asset = await prisma.asset.findFirst({
          where: {
            id: sampleAssetId,
            userId: user.id,
            type: { in: ["AUDIO", "VIDEO"] },
          },
        });
        if (!asset) {
          return res.status(400).json({
            success: false,
            error: "Invalid sample asset",
          });
        }
        resolvedSampleUrl = asset.url;
        resolvedSampleAssetId = asset.id;
      }

      if (!resolvedSampleUrl) {
        return res.status(400).json({
          success: false,
          error: "sample_asset_id or sample_url is required",
        });
      }

      const balance = await getCreditBalance(user.id);
      if (balance < VOICE_CLONE_CREDIT_COST) {
        return res.status(402).json({
          success: false,
          error: `Insufficient credits. Need ${VOICE_CLONE_CREDIT_COST}, have ${balance}`,
          creditsRemaining: balance,
        });
      }

      let sampleBuffer: Buffer;
      try {
        sampleBuffer = await downloadFromStorageUrl(resolvedSampleUrl);
      } catch {
        return res.status(400).json({
          success: false,
          error: "Failed to fetch voice sample from storage",
        });
      }
      if (sampleBuffer.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Voice sample is empty",
        });
      }

      const assetRecord = resolvedSampleAssetId
        ? await prisma.asset.findUnique({ where: { id: resolvedSampleAssetId } })
        : null;
      const mimeType = inferMimeType(
        resolvedSampleUrl,
        assetRecord?.mimeType,
      );
      const fileName = inferFileName(resolvedSampleUrl, mimeType);

      const client = getElevenLabsClient();
      const { voiceId: elevenLabsVoiceId } =
        await client.createInstantVoiceClone({
          name: nameText,
          description: descriptionText || undefined,
          sampleBuffer,
          sampleFileName: fileName,
          sampleMimeType: mimeType,
        });

      let sampleAssetIdToStore = resolvedSampleAssetId;
      if (!sampleAssetIdToStore) {
        const sampleAsset = await createAsset({
          userId: user.id,
          url: resolvedSampleUrl,
          name: `Voice clone sample — ${nameText}`,
          type: mimeType.startsWith("video/") ? "VIDEO" : "AUDIO",
          source: "UPLOAD",
          mimeType,
        });
        sampleAssetIdToStore = sampleAsset.id;
      }

      const clone = await prisma.voiceClone.create({
        data: {
          userId: user.id,
          name: nameText,
          description: descriptionText || null,
          elevenLabsVoiceId,
          sampleAssetId: sampleAssetIdToStore,
        },
        include: { sampleAsset: true },
      });

      let creditsRemaining: number;
      try {
        const consumption = await consumeCredits({
          userId: user.id,
          amount: VOICE_CLONE_CREDIT_COST,
          reason: "voice.clone",
          metadata: {
            voiceCloneId: clone.id,
            elevenLabsVoiceId,
          },
        });
        creditsRemaining = consumption.balanceAfter;
      } catch (err) {
        await prisma.voiceClone.delete({ where: { id: clone.id } }).catch(() => {});
        await client.deleteVoice(elevenLabsVoiceId).catch(() => {});

        if (err instanceof InsufficientCreditsError) {
          return res.status(402).json({
            success: false,
            error: err.message,
            creditsRemaining: err.available,
          });
        }
        throw err;
      }

      return res.json({
        success: true,
        clone,
        creditsDeducted: VOICE_CLONE_CREDIT_COST,
        creditsRemaining,
      });
    } catch (error) {
      console.error("Create voice clone error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  /** DELETE /api/voice-clones/:cloneId */
  async deleteClone(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;
      const { cloneId } = req.params;

      if (!cloneId) {
        return res
          .status(400)
          .json({ success: false, error: "Clone ID is required" });
      }

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const clone = await prisma.voiceClone.findFirst({
        where: { id: cloneId, userId: user.id },
      });

      if (!clone) {
        return res
          .status(404)
          .json({ success: false, error: "Voice clone not found" });
      }

      if (isElevenLabsConfigured()) {
        try {
          await getElevenLabsClient().deleteVoice(clone.elevenLabsVoiceId);
        } catch (err) {
          console.error(
            `Failed to delete ElevenLabs voice ${clone.elevenLabsVoiceId}:`,
            err,
          );
        }
      }

      await prisma.voiceClone.delete({ where: { id: clone.id } });

      return res.json({
        success: true,
        message: "Voice clone deleted",
      });
    } catch (error) {
      console.error("Delete voice clone error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
}
