import { Request, Response } from "express";
import prisma from "../lib/db";
import { addVoiceGenerationJob } from "../queue/voice-generation.queue";
import {
  DEFAULT_VOICE_MODEL_KEY,
  CLONED_VOICE_MODEL_KEY,
  ELEVEN_V3_MODEL_KEY,
  VOICE_EMOTIONS,
  VOICE_MODELS,
  VOICE_PRESETS,
} from "../config/models";
import { resolveVoiceForUser, type ResolvedVoice } from "../lib/voice-resolver";
import { listElevenV3Voices } from "../lib/voice-catalog";
import { isElevenLabsConfigured } from "../lib/elevenlabs-api";
import {
  consumeCredits,
  getCreditBalance,
  InsufficientCreditsError,
} from "../lib/credits";

const VALID_OUTPUT_FORMATS = ["mp3", "wav", "flac"] as const;
const MAX_TEXT_LENGTH = 10000;

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

function resolveModelConfig(modelKey: string) {
  return VOICE_MODELS[modelKey] ?? VOICE_MODELS[DEFAULT_VOICE_MODEL_KEY];
}

/**
 * Create a voice generation from validated input: resolves the model from the
 * voice, charges credits, and queues the job. Shared by the app controller and
 * the public v1 API. Throws InsufficientCreditsError when the balance is short.
 */
export async function createVoiceGenerationForUser(params: {
  userId: string;
  text: string;
  resolvedVoice: ResolvedVoice;
  /** Requested model key — only honored for MiniMax presets (legacy). */
  modelKey?: string;
  emotion?: string;
  speed?: number;
  stability?: number;
  similarity?: number;
  outputFormat?: string;
  apiKeyId?: string;
}) {
  const { userId, text, resolvedVoice } = params;

  const resolvedModelKey =
    resolvedVoice.source === "clone"
      ? CLONED_VOICE_MODEL_KEY
      : (resolvedVoice.presetModelKey ??
        (params.modelKey && VOICE_MODELS[params.modelKey]
          ? params.modelKey
          : DEFAULT_VOICE_MODEL_KEY));
  const modelConfig = resolveModelConfig(resolvedModelKey);
  const isElevenV3 = modelConfig.key === ELEVEN_V3_MODEL_KEY;

  // Eleven v3 only outputs mp3; other params fall back to provider defaults.
  const outputFormat = isElevenV3 ? "mp3" : (params.outputFormat ?? "mp3");
  const emotion = params.emotion ?? "neutral";
  const speed = params.speed ?? 1;

  const creditCost = modelConfig.credits({ charCount: text.length });

  const extraParams: Record<string, string | number> = {};
  if (isElevenV3) {
    if (params.stability !== undefined) extraParams.stability = params.stability;
    if (params.similarity !== undefined)
      extraParams.similarity = params.similarity;
  }
  if (params.apiKeyId) extraParams.apiKeyId = params.apiKeyId;

  const generation = await prisma.voiceGeneration.create({
    data: {
      userId,
      model: modelConfig.dbModel,
      text,
      voiceId: resolvedVoice.voiceId,
      emotion,
      speed,
      outputFormat,
      creditsUsed: creditCost,
      status: "QUEUED",
      params: Object.keys(extraParams).length > 0 ? extraParams : undefined,
    },
  });

  let consumption;
  try {
    consumption = await consumeCredits({
      userId,
      amount: creditCost,
      reason: "voice.generation",
      apiKeyId: params.apiKeyId,
      metadata: {
        generationId: generation.id,
        model: modelConfig.dbModel,
      },
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      await prisma.voiceGeneration
        .delete({ where: { id: generation.id } })
        .catch(() => {});
    }
    throw err;
  }

  await addVoiceGenerationJob({
    userId,
    generationId: generation.id,
    creditsUsed: creditCost,
    creditTransactionId: consumption.transactionId,
    text,
    voiceId: resolvedVoice.voiceId,
    voiceSource: resolvedVoice.source,
    presetVoiceId: resolvedVoice.presetVoiceId,
    elevenLabsVoiceId: resolvedVoice.elevenLabsVoiceId,
    emotion,
    speed,
    stability: isElevenV3 ? params.stability : undefined,
    similarity: isElevenV3 ? params.similarity : undefined,
    modelKey: modelConfig.key,
    endpoint: modelConfig.endpoint,
    outputFormat,
  });

  return {
    generation,
    creditsDeducted: creditCost,
    creditsRemaining: consumption.balanceAfter,
  };
}

/**
 * Validate the shared voice-generation request shape. Returns an error string
 * or the normalized values. Used by both the app and public v1 controllers.
 */
export function validateVoiceGenerationInput(params: {
  text: unknown;
  resolvedVoice: ResolvedVoice;
  emotion?: unknown;
  speed?: unknown;
  stability?: unknown;
  similarity?: unknown;
  outputFormat?: unknown;
}):
  | { ok: false; error: string }
  | {
      ok: true;
      text: string;
      emotion: string;
      speed: number;
      stability?: number;
      similarity?: number;
      outputFormat: string;
    } {
  const { resolvedVoice } = params;
  const isElevenV3 =
    resolvedVoice.source === "preset" &&
    resolvedVoice.presetModelKey === ELEVEN_V3_MODEL_KEY;

  const text = typeof params.text === "string" ? params.text.trim() : "";
  if (text.length === 0) {
    return { ok: false, error: "Text is required" };
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return {
      ok: false,
      error: `Text must be at most ${MAX_TEXT_LENGTH} characters`,
    };
  }

  const emotion =
    typeof params.emotion === "string" ? params.emotion : "neutral";
  if (
    resolvedVoice.source === "preset" &&
    !isElevenV3 &&
    !VOICE_EMOTIONS.includes(emotion as (typeof VOICE_EMOTIONS)[number])
  ) {
    return {
      ok: false,
      error: `Invalid emotion. Must be one of: ${VOICE_EMOTIONS.join(", ")}`,
    };
  }

  const speed = params.speed === undefined ? 1 : Number(params.speed);
  if (Number.isNaN(speed) || speed < 0.5 || speed > 2) {
    return { ok: false, error: "Speed must be between 0.5 and 2.0" };
  }

  let stability: number | undefined;
  let similarity: number | undefined;
  if (isElevenV3) {
    if (params.stability !== undefined) {
      stability = Number(params.stability);
      if (Number.isNaN(stability) || stability < 0 || stability > 1) {
        return { ok: false, error: "Stability must be between 0 and 1" };
      }
    }
    if (params.similarity !== undefined) {
      similarity = Number(params.similarity);
      if (Number.isNaN(similarity) || similarity < 0 || similarity > 1) {
        return { ok: false, error: "Similarity must be between 0 and 1" };
      }
    }
  }

  const outputFormat =
    typeof params.outputFormat === "string" ? params.outputFormat : "mp3";
  if (
    !VALID_OUTPUT_FORMATS.includes(
      outputFormat as (typeof VALID_OUTPUT_FORMATS)[number],
    )
  ) {
    return {
      ok: false,
      error: `Invalid output_format. Must be one of: ${VALID_OUTPUT_FORMATS.join(", ")}`,
    };
  }

  return { ok: true, text, emotion, speed, stability, similarity, outputFormat };
}

export class VoiceGenerationController {
  async getOptions(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;
      const user = await resolveUser(clerkUserId);

      const clones = user
        ? await prisma.voiceClone.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            select: { id: true, name: true, description: true, createdAt: true },
          })
        : [];

      return res.json({
        success: true,
        voices: VOICE_PRESETS,
        elevenV3Voices: listElevenV3Voices(),
        clones,
        emotions: VOICE_EMOTIONS,
        models: Object.values(VOICE_MODELS).map((m) => ({
          key: m.key,
          displayName: m.displayName,
        })),
        elevenLabsConfigured: isElevenLabsConfigured(),
      });
    } catch (error) {
      console.error("Get voice options error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async createGeneration(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const {
        text,
        voice_id: voiceId = "Friendly_Person",
        emotion,
        speed,
        stability,
        similarity,
        model: modelKey = DEFAULT_VOICE_MODEL_KEY,
        output_format: outputFormat,
      } = req.body;

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const resolvedVoice = await resolveVoiceForUser(user.id, voiceId);
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

      if (resolvedVoice.source === "preset" && !process.env.WAVESPEED_API_KEY) {
        return res.status(503).json({
          success: false,
          error: "Preset voices require WaveSpeed configuration",
        });
      }

      const validated = validateVoiceGenerationInput({
        text,
        resolvedVoice,
        emotion,
        speed,
        stability,
        similarity,
        outputFormat,
      });
      if (!validated.ok) {
        return res.status(400).json({ success: false, error: validated.error });
      }

      const modelConfig = resolveModelConfig(
        resolvedVoice.source === "clone"
          ? CLONED_VOICE_MODEL_KEY
          : (resolvedVoice.presetModelKey ?? modelKey),
      );
      const creditCost = modelConfig.credits({
        charCount: validated.text.length,
      });
      const balance = await getCreditBalance(user.id);
      if (balance < creditCost) {
        return res.status(402).json({
          success: false,
          error: `Insufficient credits. Need ${creditCost}, have ${balance}`,
          creditsRemaining: balance,
        });
      }

      try {
        const { generation, creditsDeducted, creditsRemaining } =
          await createVoiceGenerationForUser({
            userId: user.id,
            text: validated.text,
            resolvedVoice,
            modelKey,
            emotion: validated.emotion,
            speed: validated.speed,
            stability: validated.stability,
            similarity: validated.similarity,
            outputFormat: validated.outputFormat,
          });

        return res.json({
          success: true,
          generation: {
            id: generation.id,
            status: "QUEUED",
          },
          creditsDeducted,
          creditsRemaining,
        });
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          return res.status(402).json({
            success: false,
            error: err.message,
            creditsRemaining: err.available,
          });
        }
        throw err;
      }
    } catch (error) {
      console.error("Create voice generation error:", error);
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
        prisma.voiceGeneration.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          include: { outputAsset: true },
        }),
        prisma.voiceGeneration.count({ where: { userId: user.id } }),
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
      console.error("Get voice generations error:", error);
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

      const generation = await prisma.voiceGeneration.findFirst({
        where: { id: generationId, userId: user.id },
        include: { outputAsset: true },
      });

      if (!generation) {
        return res
          .status(404)
          .json({ success: false, error: "Generation not found" });
      }

      return res.json({ success: true, generation });
    } catch (error) {
      console.error("Refresh voice generation status error:", error);
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

      await prisma.voiceGeneration.delete({
        where: { id: generationId, userId: user.id },
      });

      return res.json({
        success: true,
        message: "Generation deleted successfully",
      });
    } catch (error) {
      console.error("Delete voice generation error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
}
