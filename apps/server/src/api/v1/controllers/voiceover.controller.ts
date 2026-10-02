import { Request, Response } from "express";
import prisma from "../../../lib/db";
import {
  CLONED_VOICE_MODEL_KEY,
  ELEVEN_V3_MODEL_KEY,
  VOICE_MODELS,
} from "../../../config/models";
import { getApiKeyId } from "../../../lib/api-public";
import { isElevenLabsConfigured } from "../../../lib/elevenlabs-api";
import { resolveVoiceForUser } from "../../../lib/voice-resolver";
import { listElevenV3Voices } from "../../../lib/voice-catalog";
import {
  getCreditBalance,
  InsufficientCreditsError,
} from "../../../lib/credits";
import { withPublicCreate } from "../helpers/public-create";
import { handlePublicError } from "../helpers/public-response";
import {
  createVoiceGenerationForUser,
  validateVoiceGenerationInput,
} from "../../../controllers/voice-generation.controller";

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

type CreateResult =
  | { ok: false; status: number; body: Record<string, unknown> }
  | { ok: true; body: Record<string, unknown> };

export class PublicVoiceoverController {
  /** GET /voiceovers/voices — Eleven v3 voice catalog with preview URLs. */
  getVoices = async (_req: Request, res: Response) => {
    try {
      return res.json({ success: true, voices: listElevenV3Voices() });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Public list voiceover voices error:",
        "Failed to list voices",
      );
    }
  };

  createGeneration = async (req: Request, res: Response) => {
    try {
      await withPublicCreate(req, res, 200, async () => {
        const result = await this.runCreate(req);
        if (!result.ok) {
          res.status(result.status).json(result.body);
          return null;
        }
        return result.body;
      });
    } catch (error) {
      console.error("Public create voiceover error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Internal server error",
        });
      }
    }
  };

  getGenerations = async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(
        Math.max(parseInt(req.query.limit as string) || 12, 1),
        100,
      );
      const offset = (page - 1) * limit;

      const user = await resolveUser(req.auth.userId);
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
      return handlePublicError(
        res,
        error,
        "Public list voiceovers error:",
        "Failed to list voiceovers",
      );
    }
  };

  deleteGeneration = async (req: Request, res: Response) => {
    try {
      const { generationId } = req.params;
      if (!generationId) {
        return res
          .status(400)
          .json({ success: false, error: "Generation ID is required" });
      }

      const user = await resolveUser(req.auth.userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      await prisma.voiceGeneration.delete({
        where: { id: generationId, userId: user.id },
      });

      return res.json({ success: true, message: "Voiceover deleted" });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Public delete voiceover error:",
        "Failed to delete voiceover",
      );
    }
  };

  private async runCreate(req: Request): Promise<CreateResult> {
    const apiKeyId = getApiKeyId(req);
    const {
      text,
      voice_id: voiceId,
      stability,
      similarity,
      model: modelKey = ELEVEN_V3_MODEL_KEY,
      emotion,
      speed,
      output_format: outputFormat,
    } = req.body;

    if (modelKey && !VOICE_MODELS[modelKey]) {
      return {
        ok: false,
        status: 400,
        body: {
          success: false,
          error: `Invalid model. Must be one of: ${Object.keys(VOICE_MODELS).join(", ")}`,
        },
      };
    }

    if (typeof voiceId !== "string" || voiceId.length === 0) {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: "voice_id is required" },
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

    const resolvedVoice = await resolveVoiceForUser(user.id, voiceId);
    if (!resolvedVoice) {
      return {
        ok: false,
        status: 400,
        body: {
          success: false,
          error:
            "Invalid voice_id. Use GET /voiceovers/voices for preset voices or " +
            "GET /voice-clones for your cloned voices.",
        },
      };
    }

    // Cloned voices run on ElevenLabs directly; presets go through WaveSpeed.
    const providerConfigured =
      resolvedVoice.source === "clone"
        ? isElevenLabsConfigured()
        : Boolean(process.env.WAVESPEED_API_KEY);
    if (!providerConfigured) {
      return {
        ok: false,
        status: 503,
        body: { success: false, error: "Voiceover generation is not configured" },
      };
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
      return {
        ok: false,
        status: 400,
        body: { success: false, error: validated.error },
      };
    }

    // Mirrors the model pick in createVoiceGenerationForUser (the actual charge).
    const modelConfig =
      resolvedVoice.source === "clone"
        ? VOICE_MODELS[CLONED_VOICE_MODEL_KEY]
        : (VOICE_MODELS[resolvedVoice.presetModelKey ?? modelKey] ??
          VOICE_MODELS[ELEVEN_V3_MODEL_KEY]);
    const creditCost = modelConfig.credits({ charCount: validated.text.length });
    const balance = await getCreditBalance(user.id);
    if (balance < creditCost) {
      return {
        ok: false,
        status: 402,
        body: {
          success: false,
          error: `Insufficient credits. Need ${creditCost}, have ${balance}`,
          creditsRemaining: balance,
        },
      };
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
          apiKeyId,
        });

      return {
        ok: true,
        body: {
          success: true,
          generation: { id: generation.id, status: "QUEUED" },
          creditsDeducted,
          creditsRemaining,
        },
      };
    } catch (err) {
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
  }
}
