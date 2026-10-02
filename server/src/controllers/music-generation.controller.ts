import { Request, Response } from "express";
import prisma from "../lib/db";
import { addMusicGenerationJob } from "../queue/music-generation.queue";
import {
  DEFAULT_MUSIC_MODEL_KEY,
  MUSIC_MODELS,
  VOICE_MODELS,
  CLONED_VOICE_MODEL_KEY,
} from "../config/models";
import { resolveVoiceCloneForUser, type ResolvedVoice } from "../lib/voice-resolver";
import { isElevenLabsConfigured } from "../lib/elevenlabs-api";
import { flattenLyricsForMusicVocal, deriveSongTitleFromLyrics } from "../lib/lyrics-utils";
import { MUSIC_VOICE_CLONE_MIX_CREDITS } from "../lib/audio-mix";
import {
  buildTrackNumberMap,
  nextTrackNumber,
  readTrackNumber,
  readSongTitle,
} from "../lib/music-track-utils";
import {
  consumeCredits,
  getCreditBalance,
  InsufficientCreditsError,
} from "../lib/credits";

const VALID_OUTPUT_FORMATS = ["mp3", "wav", "flac"] as const;
const MAX_LYRICS_LENGTH = 3000;
const MAX_PROMPT_LENGTH = 1024;

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

function resolveModelConfig(modelKey: string) {
  return MUSIC_MODELS[modelKey] ?? MUSIC_MODELS[DEFAULT_MUSIC_MODEL_KEY];
}

function withTrackNumber<T extends { id: string; params?: unknown; lyrics?: string; prompt?: string }>(
  generation: T,
  trackMap: Map<string, number>,
): T & { trackNumber: number; songTitle: string } {
  const songTitle =
    readSongTitle(generation.params) ??
    deriveSongTitleFromLyrics(generation.lyrics ?? "", generation.prompt);
  return {
    ...generation,
    trackNumber:
      readTrackNumber(generation.params) ?? trackMap.get(generation.id) ?? 0,
    songTitle,
  };
}

export class MusicGenerationController {
  // POST /api/music-generations/create
  async createGeneration(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const {
        lyrics,
        prompt,
        model: modelKey = DEFAULT_MUSIC_MODEL_KEY,
        output_format: outputFormat = "mp3",
        voice_id: voiceId,
      } = req.body;

      const modelConfig = resolveModelConfig(modelKey);
      if (!MUSIC_MODELS[modelKey]) {
        return res.status(400).json({
          success: false,
          error: `Invalid model. Must be one of: ${Object.keys(MUSIC_MODELS).join(", ")}`,
        });
      }

      if (!process.env.WAVESPEED_API_KEY) {
        return res.status(503).json({
          success: false,
          error: "Music generation is not configured",
        });
      }

      const lyricsText =
        typeof lyrics === "string" ? lyrics.trim() : "";
      const promptText =
        typeof prompt === "string" ? prompt.trim() : "";

      if (modelConfig.kind === "song" && lyricsText.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Lyrics are required" });
      }

      if (promptText.length === 0 && lyricsText.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Style prompt or lyrics are required",
        });
      }

      if (lyricsText.length > MAX_LYRICS_LENGTH) {
        return res.status(400).json({
          success: false,
          error: `Lyrics must be at most ${MAX_LYRICS_LENGTH} characters`,
        });
      }

      if (promptText.length > MAX_PROMPT_LENGTH) {
        return res.status(400).json({
          success: false,
          error: `Style prompt must be at most ${MAX_PROMPT_LENGTH} characters`,
        });
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

      const voiceIdText =
        typeof voiceId === "string" && voiceId.trim().length > 0
          ? voiceId.trim()
          : undefined;

      let resolvedVoiceClone: ResolvedVoice | null = null;
      if (voiceIdText) {
        if (!isElevenLabsConfigured()) {
          return res.status(503).json({
            success: false,
            error: "Cloned vocals require ElevenLabs configuration",
          });
        }
        resolvedVoiceClone = await resolveVoiceCloneForUser(user.id, voiceIdText);
        if (!resolvedVoiceClone) {
          return res.status(400).json({
            success: false,
            error: "Invalid voice clone — only your cloned voices are supported for songs",
          });
        }
        if (lyricsText.length === 0) {
          return res.status(400).json({
            success: false,
            error: "Lyrics are required when using a cloned voice",
          });
        }
      }

      const bgmModel = MUSIC_MODELS["mureka-7.5"];
      const vocalText = resolvedVoiceClone
        ? flattenLyricsForMusicVocal(lyricsText)
        : "";
      if (resolvedVoiceClone && vocalText.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Lyrics must contain speakable text for cloned vocals",
        });
      }

      const ttsModel = VOICE_MODELS[CLONED_VOICE_MODEL_KEY];
      const creditCost = resolvedVoiceClone
        ? bgmModel.credits() +
          ttsModel.credits({ charCount: vocalText.length }) +
          MUSIC_VOICE_CLONE_MIX_CREDITS
        : modelConfig.credits();
      const balance = await getCreditBalance(user.id);
      if (balance < creditCost) {
        return res.status(402).json({
          success: false,
          error: `Insufficient credits. Need ${creditCost}, have ${balance}`,
          creditsRemaining: balance,
        });
      }

      const trackNumber = await nextTrackNumber(user.id);
      const songTitle = deriveSongTitleFromLyrics(lyricsText, promptText);

      const generation = await prisma.musicGeneration.create({
        data: {
          userId: user.id,
          model: resolvedVoiceClone ? "mureka-v7.5+elevenlabs" : modelConfig.dbModel,
          lyrics: lyricsText,
          prompt: promptText,
          outputFormat,
          voiceId: resolvedVoiceClone?.voiceId,
          creditsUsed: creditCost,
          status: "QUEUED",
          params: {
            trackNumber,
            songTitle,
            ...(resolvedVoiceClone
              ? { mode: "voice_clone", vocalText }
              : {}),
          },
        },
      });

      let creditTransactionId: string;
      let creditsRemaining: number;
      try {
        const consumption = await consumeCredits({
          userId: user.id,
          amount: creditCost,
          reason: "music.generation",
          metadata: {
            generationId: generation.id,
            model: modelConfig.dbModel,
          },
        });
        creditTransactionId = consumption.transactionId;
        creditsRemaining = consumption.balanceAfter;
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          await prisma.musicGeneration
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

      await addMusicGenerationJob({
        userId: user.id,
        generationId: generation.id,
        creditsUsed: creditCost,
        creditTransactionId,
        lyrics: lyricsText,
        prompt: promptText,
        modelKey: modelConfig.key,
        endpoint: modelConfig.endpoint,
        kind: modelConfig.kind,
        outputFormat,
        voiceCloneMode: Boolean(resolvedVoiceClone),
        elevenLabsVoiceId: resolvedVoiceClone?.elevenLabsVoiceId,
        vocalText: resolvedVoiceClone ? vocalText : undefined,
        bgmEndpoint: bgmModel.endpoint,
        trackNumber,
        songTitle,
      });

      return res.json({
        success: true,
        generation: {
          id: generation.id,
          status: "QUEUED",
          trackNumber,
          songTitle,
        },
        creditsDeducted: creditCost,
        creditsRemaining,
      });
    } catch (error) {
      console.error("Create music generation error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  // GET /api/music-generations/all
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

      const [generations, totalCount, trackMap] = await Promise.all([
        prisma.musicGeneration.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          include: { outputAsset: true },
        }),
        prisma.musicGeneration.count({ where: { userId: user.id } }),
        buildTrackNumberMap(user.id),
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return res.json({
        success: true,
        generations: generations.map((g) => withTrackNumber(g, trackMap)),
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
      console.error("Get music generations error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  // GET /api/music-generations/refresh/:generationId
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

      const generation = await prisma.musicGeneration.findFirst({
        where: { id: generationId, userId: user.id },
        include: { outputAsset: true },
      });

      if (!generation) {
        return res
          .status(404)
          .json({ success: false, error: "Generation not found" });
      }

      const trackMap = await buildTrackNumberMap(user.id);

      return res.json({
        success: true,
        generation: withTrackNumber(generation, trackMap),
      });
    } catch (error) {
      console.error("Refresh music generation status error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  // DELETE /api/music-generations/:generationId
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

      await prisma.musicGeneration.delete({
        where: { id: generationId, userId: user.id },
      });

      return res.json({
        success: true,
        message: "Generation deleted successfully",
      });
    } catch (error) {
      console.error("Delete music generation error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
}

export async function createMusicGenerationForUser(params: {
  userId: string;
  lyrics: string;
  prompt: string;
  modelKey?: string;
  outputFormat?: string;
  apiKeyId?: string;
}) {
  const modelConfig = resolveModelConfig(
    params.modelKey ?? DEFAULT_MUSIC_MODEL_KEY,
  );
  const outputFormat = params.outputFormat ?? "mp3";
  const creditCost = modelConfig.credits();

  const generation = await prisma.musicGeneration.create({
    data: {
      userId: params.userId,
      model: modelConfig.dbModel,
      lyrics: params.lyrics,
      prompt: params.prompt,
      outputFormat,
      creditsUsed: creditCost,
      status: "QUEUED",
      params: params.apiKeyId ? { apiKeyId: params.apiKeyId } : undefined,
    },
  });

  const consumption = await consumeCredits({
    userId: params.userId,
    amount: creditCost,
    reason: "music.generation",
    apiKeyId: params.apiKeyId,
    metadata: { generationId: generation.id, model: modelConfig.dbModel },
  });

  await addMusicGenerationJob({
    userId: params.userId,
    generationId: generation.id,
    creditsUsed: creditCost,
    creditTransactionId: consumption.transactionId,
    lyrics: params.lyrics,
    prompt: params.prompt,
    modelKey: modelConfig.key,
    endpoint: modelConfig.endpoint,
    kind: modelConfig.kind,
    outputFormat,
  });

  return {
    generation,
    creditsDeducted: creditCost,
    creditsRemaining: consumption.balanceAfter,
  };
}
