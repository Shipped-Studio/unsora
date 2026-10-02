import { Request, Response } from "express";
import prisma from "../../../lib/db";
import {
  DEFAULT_MUSIC_MODEL_KEY,
  MUSIC_MODELS,
} from "../../../config/models";
import { getApiKeyId } from "../../../lib/api-public";
import {
  getCreditBalance,
  InsufficientCreditsError,
} from "../../../lib/credits";
import { withPublicCreate } from "../helpers/public-create";
import { handlePublicError } from "../helpers/public-response";
import {
  createMusicGenerationForUser,
  MusicGenerationController,
} from "../../../controllers/music-generation.controller";

const musicGenerationInclude = {
  outputAsset: true,
};

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

type CreateResult =
  | { ok: false; status: number; body: Record<string, unknown> }
  | { ok: true; body: Record<string, unknown> };

const MAX_LYRICS_LENGTH = 3000;
const MAX_PROMPT_LENGTH = 1024;
const VALID_OUTPUT_FORMATS = ["mp3", "wav", "flac"] as const;

export class PublicMusicController {
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
      console.error("Public create music generation error:", error);
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
      const controller = new MusicGenerationController();
      return controller.getGenerations(req, res);
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Public list music generations error:",
        "Failed to list music generations",
      );
    }
  };

  getGeneration = async (req: Request, res: Response) => {
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

      const generation = await prisma.musicGeneration.findFirst({
        where: { id: generationId, userId: user.id },
        include: musicGenerationInclude,
      });

      if (!generation) {
        return res
          .status(404)
          .json({ success: false, error: "Generation not found" });
      }

      return res.json({ success: true, generation });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Public get music generation error:",
        "Failed to fetch music generation",
      );
    }
  };

  deleteGeneration = async (req: Request, res: Response) => {
    try {
      const controller = new MusicGenerationController();
      return controller.deleteGeneration(req, res);
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Public delete music generation error:",
        "Failed to delete music generation",
      );
    }
  };

  private async runCreate(req: Request): Promise<CreateResult> {
    const apiKeyId = getApiKeyId(req);
    const {
      lyrics,
      prompt,
      model: modelKey = DEFAULT_MUSIC_MODEL_KEY,
      output_format: outputFormat = "mp3",
    } = req.body;

    const modelConfig = MUSIC_MODELS[modelKey];
    if (!modelConfig) {
      return {
        ok: false,
        status: 400,
        body: {
          success: false,
          error: `Invalid model. Must be one of: ${Object.keys(MUSIC_MODELS).join(", ")}`,
        },
      };
    }

    if (!process.env.WAVESPEED_API_KEY) {
      return {
        ok: false,
        status: 503,
        body: { success: false, error: "Music generation is not configured" },
      };
    }

    const lyricsText = typeof lyrics === "string" ? lyrics.trim() : "";
    const promptText = typeof prompt === "string" ? prompt.trim() : "";

    if (modelConfig.kind === "song" && lyricsText.length === 0) {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: "Lyrics are required" },
      };
    }

    if (promptText.length === 0 && lyricsText.length === 0) {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: "Style prompt or lyrics are required" },
      };
    }

    if (lyricsText.length > MAX_LYRICS_LENGTH) {
      return {
        ok: false,
        status: 400,
        body: {
          success: false,
          error: `Lyrics must be at most ${MAX_LYRICS_LENGTH} characters`,
        },
      };
    }

    if (promptText.length > MAX_PROMPT_LENGTH) {
      return {
        ok: false,
        status: 400,
        body: {
          success: false,
          error: `Style prompt must be at most ${MAX_PROMPT_LENGTH} characters`,
        },
      };
    }

    if (!VALID_OUTPUT_FORMATS.includes(outputFormat)) {
      return {
        ok: false,
        status: 400,
        body: {
          success: false,
          error: `Invalid output_format. Must be one of: ${VALID_OUTPUT_FORMATS.join(", ")}`,
        },
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

    const creditCost = modelConfig.credits();
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
        await createMusicGenerationForUser({
          userId: user.id,
          lyrics: lyricsText,
          prompt: promptText,
          modelKey,
          outputFormat,
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
