import { Request, Response } from "express";
import prisma from "../lib/db";
import { addAvatarGenerationJob } from "../queue/avatar-generation.queue";
import {
  AVATAR_MODELS,
  DEFAULT_AVATAR_MODEL_KEY,
} from "../config/models";
import {
  consumeCredits,
  getCreditBalance,
  InsufficientCreditsError,
} from "../lib/credits";
import { resolveVoiceForUser, type ResolvedVoice } from "../lib/voice-resolver";
import { isElevenLabsConfigured } from "../lib/elevenlabs-api";
import { AVATAR_MAX_AUDIO_SECONDS, estimateSpeechSeconds } from "../lib/avatar-speech";
import { DURATION_TOLERANCE_SECONDS, measureMediaSeconds } from "../lib/media-limits";

const VALID_RESOLUTIONS = ["480p", "720p"] as const;
const VALID_EMOTIONS = [
  "happy",
  "sad",
  "angry",
  "fearful",
  "disgusted",
  "surprised",
  "neutral",
] as const;
const MAX_TRANSCRIPT_LENGTH = 2000;

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

function resolveModelConfig(modelKey: string) {
  return AVATAR_MODELS[modelKey] ?? AVATAR_MODELS[DEFAULT_AVATAR_MODEL_KEY];
}

export class AvatarGenerationController {
  async createGeneration(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const {
        transcript,
        image_url: imageUrl,
        image_asset_id: imageAssetId,
        audio_url: audioUrl,
        emotion = "neutral",
        prompt = "",
        resolution = "720p",
        voice_id: voiceId = "Friendly_Person",
        model: modelKey = DEFAULT_AVATAR_MODEL_KEY,
      } = req.body;

      const modelConfig = resolveModelConfig(modelKey);
      if (!AVATAR_MODELS[modelKey]) {
        return res.status(400).json({
          success: false,
          error: `Invalid model. Must be one of: ${Object.keys(AVATAR_MODELS).join(", ")}`,
        });
      }

      if (!process.env.WAVESPEED_API_KEY) {
        return res.status(503).json({
          success: false,
          error: "Avatar generation is not configured",
        });
      }

      const transcriptText =
        typeof transcript === "string" ? transcript.trim() : "";
      const promptText = typeof prompt === "string" ? prompt.trim() : "";
      const imageUrlText = typeof imageUrl === "string" ? imageUrl.trim() : "";
      const audioUrlText = typeof audioUrl === "string" ? audioUrl.trim() : "";

      if (!transcriptText && !audioUrlText) {
        return res.status(400).json({
          success: false,
          error: "Transcript or audio URL is required",
        });
      }

      if (transcriptText.length > MAX_TRANSCRIPT_LENGTH) {
        return res.status(400).json({
          success: false,
          error: `Transcript must be at most ${MAX_TRANSCRIPT_LENGTH} characters`,
        });
      }

      // The model bills per second of speech but the price is flat, so the
      // 20-second cap the app shows is enforced here too.
      if (
        transcriptText &&
        estimateSpeechSeconds(transcriptText) > AVATAR_MAX_AUDIO_SECONDS
      ) {
        return res.status(400).json({
          success: false,
          error: `The script is too long. Keep it under ${AVATAR_MAX_AUDIO_SECONDS} seconds of speech.`,
        });
      }
      if (audioUrlText) {
        const audioSeconds = await measureMediaSeconds(audioUrlText);
        if (!audioSeconds) {
          return res.status(400).json({
            success: false,
            error: "Couldn't read the audio's length. Upload an MP3, WAV or M4A file.",
          });
        }
        if (audioSeconds > AVATAR_MAX_AUDIO_SECONDS + DURATION_TOLERANCE_SECONDS) {
          return res.status(400).json({
            success: false,
            error: `The audio must be ${AVATAR_MAX_AUDIO_SECONDS} seconds or shorter.`,
          });
        }
      }

      if (!VALID_RESOLUTIONS.includes(resolution)) {
        return res.status(400).json({
          success: false,
          error: `Invalid resolution. Must be one of: ${VALID_RESOLUTIONS.join(", ")}`,
        });
      }

      if (!VALID_EMOTIONS.includes(emotion)) {
        return res.status(400).json({
          success: false,
          error: `Invalid emotion. Must be one of: ${VALID_EMOTIONS.join(", ")}`,
        });
      }

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      let resolvedVoice: ResolvedVoice | null = null;
      if (transcriptText) {
        resolvedVoice = await resolveVoiceForUser(user.id, voiceId);
        if (!resolvedVoice) {
          return res.status(400).json({
            success: false,
            error: "Invalid voice_id",
          });
        }

        if (resolvedVoice.source === "clone" && !isElevenLabsConfigured()) {
          return res.status(503).json({
            success: false,
            error: "Cloned voices require ElevenLabs configuration",
          });
        }

        if (
          resolvedVoice.source === "preset" &&
          !process.env.WAVESPEED_API_KEY
        ) {
          return res.status(503).json({
            success: false,
            error: "Preset voices require WaveSpeed configuration",
          });
        }
      }

      let resolvedImageUrl = imageUrlText;
      let resolvedImageAssetId: string | undefined;

      if (imageAssetId) {
        const asset = await prisma.asset.findFirst({
          where: { id: imageAssetId, userId: user.id, type: "IMAGE" },
        });
        if (!asset) {
          return res.status(400).json({
            success: false,
            error: "Invalid image asset",
          });
        }
        resolvedImageUrl = asset.url;
        resolvedImageAssetId = asset.id;
      }

      if (!resolvedImageUrl) {
        return res.status(400).json({
          success: false,
          error: "Portrait image is required",
        });
      }

      const creditCost = modelConfig.credits();
      const balance = await getCreditBalance(user.id);
      if (balance < creditCost) {
        return res.status(402).json({
          success: false,
          error: `Insufficient credits. Need ${creditCost}, have ${balance}`,
          creditsRemaining: balance,
        });
      }

      const generation = await prisma.avatarGeneration.create({
        data: {
          userId: user.id,
          model: modelConfig.dbModel,
          transcript: transcriptText,
          emotion,
          prompt: promptText,
          resolution,
          voiceId: resolvedVoice?.voiceId ?? voiceId,
          imageAssetId: resolvedImageAssetId,
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
          reason: "avatar.generation",
          metadata: {
            generationId: generation.id,
            model: modelConfig.dbModel,
          },
        });
        creditTransactionId = consumption.transactionId;
        creditsRemaining = consumption.balanceAfter;
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          await prisma.avatarGeneration
            .delete({ where: { id: generation.id } })
            .catch(() => {});
          return res.status(402).json({
            success: false,
            error: err.message,
            creditsRemaining: err.available,
          });
        }
        throw err;
      }

      await addAvatarGenerationJob({
        userId: user.id,
        generationId: generation.id,
        creditsUsed: creditCost,
        creditTransactionId,
        transcript: transcriptText,
        emotion,
        prompt: promptText,
        resolution,
        voiceId: resolvedVoice?.voiceId ?? voiceId,
        voiceSource: resolvedVoice?.source ?? "preset",
        presetVoiceId: resolvedVoice?.presetVoiceId,
        elevenLabsVoiceId: resolvedVoice?.elevenLabsVoiceId,
        modelKey: modelConfig.key,
        endpoint: modelConfig.endpoint,
        imageUrl: resolvedImageUrl,
        audioUrl: audioUrlText || undefined,
      });

      return res.json({
        success: true,
        generation: {
          id: generation.id,
          status: "QUEUED",
        },
        creditsDeducted: creditCost,
        creditsRemaining,
      });
    } catch (error) {
      console.error("Create avatar generation error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async getGenerations(req: Request, res: Response) {
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
        prisma.avatarGeneration.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          include: {
            outputAsset: true,
            imageAsset: true,
            audioAsset: true,
          },
        }),
        prisma.avatarGeneration.count({ where: { userId: user.id } }),
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
      console.error("Get avatar generations error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async refreshGenerationStatus(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;
      const { generationId } = req.params;

      if (!generationId) {
        return res
          .status(400)
          .json({ success: false, error: "Generation ID is required" });
      }

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const generation = await prisma.avatarGeneration.findFirst({
        where: { id: generationId, userId: user.id },
        include: {
          outputAsset: true,
          imageAsset: true,
          audioAsset: true,
        },
      });

      if (!generation) {
        return res
          .status(404)
          .json({ success: false, error: "Generation not found" });
      }

      return res.json({ success: true, generation });
    } catch (error) {
      console.error("Refresh avatar generation status error:", error);
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

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      await prisma.avatarGeneration.delete({
        where: { id: generationId, userId: user.id },
      });

      return res.json({
        success: true,
        message: "Generation deleted successfully",
      });
    } catch (error) {
      console.error("Delete avatar generation error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
}
