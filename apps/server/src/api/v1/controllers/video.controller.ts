import { Request, Response } from "express";
import prisma from "../../../lib/db";
import { addVideoGenerationJob } from "../../../queue/video-generation.queue";
import { createAsset } from "../../../lib/asset-utils";
import { VIDEO_MODELS, type VideoModelConfig } from "../../../config/models";
import { CATALOG, catalogDbModels } from "../../../config/catalog";
import {
  consumeCredits,
  getCreditBalance,
  InsufficientCreditsError,
  refundConsumption,
} from "../../../lib/credits";
import { getApiKeyId } from "../../../lib/api-public";
import { withPublicCreate } from "../helpers/public-create";
import { handlePublicError } from "../helpers/public-response";

// Accept both the public model key ("seedance-2.0", "veo", "kling-pro", …)
// and the dbModel form ("seedance_2.0", "veo3_1", …) as the `model` param.
const MODEL_LOOKUP: Record<string, VideoModelConfig> = {};
for (const cfg of Object.values(VIDEO_MODELS)) {
  MODEL_LOOKUP[cfg.key] = cfg;
  MODEL_LOOKUP[cfg.dbModel] = cfg;
}

const VALID_MODEL_KEYS = Object.values(VIDEO_MODELS).map((m) => m.key);
const VIDEO_DB_MODELS = [
  ...Object.values(VIDEO_MODELS).map((m) => m.dbModel),
  ...catalogDbModels("video"),
];

// `?model=` on the list → every stored name for that model. A catalog model
// covers its own key plus the names older rows were saved under.
const LIST_FILTERS: Record<string, string[]> = {};
for (const m of CATALOG) {
  if (m.category !== "video") continue;
  const names = [m.key, ...(m.legacyDbModels ?? [])];
  for (const name of names) LIST_FILTERS[name] = names;
}
for (const cfg of Object.values(VIDEO_MODELS)) {
  const names = LIST_FILTERS[cfg.dbModel] ?? [cfg.dbModel];
  LIST_FILTERS[cfg.key] ??= names;
  LIST_FILTERS[cfg.dbModel] ??= names;
}

const DEFAULT_MODEL_KEY = "seedance-2.0";

function isSeedanceModel(cfg: VideoModelConfig): boolean {
  return cfg.key.startsWith("seedance");
}

function strArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) return undefined;
  return value.filter((v): v is string => typeof v === "string");
}

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

type CreateResult =
  | { ok: false; status: number; body: Record<string, unknown> }
  | { ok: true; body: Record<string, unknown> };

export class PublicVideoController {
  create = async (req: Request, res: Response) => {
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
      return handlePublicError(
        res,
        error,
        "Public create video error:",
        "Failed to create video generation",
      );
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

      // Optional ?model= filter (key or dbModel); defaults to all video models.
      let modelFilter: string[] = VIDEO_DB_MODELS;
      const modelParam = req.query.model as string | undefined;
      if (modelParam) {
        const names = LIST_FILTERS[modelParam];
        if (!names) {
          return res.status(400).json({
            success: false,
            error: `Invalid model. Must be one of: ${[
              ...new Set([...catalogDbModels("video"), ...VALID_MODEL_KEYS]),
            ].join(", ")}`,
          });
        }
        modelFilter = names;
      }

      const where = { userId: user.id, model: { in: modelFilter } };

      const [generations, totalCount] = await Promise.all([
        prisma.generation.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          include: {
            outputAsset: true,
            thumbnailAsset: true,
            inputAssets: { include: { asset: true }, orderBy: { order: "asc" } },
          },
        }),
        prisma.generation.count({ where }),
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
        "Public list video generations error:",
        "Failed to fetch video generations",
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

      const deleted = await prisma.generation.deleteMany({
        where: {
          id: generationId,
          userId: user.id,
          model: { in: VIDEO_DB_MODELS },
        },
      });

      if (deleted.count === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Video generation not found" });
      }

      return res.json({
        success: true,
        message: "Generation deleted successfully",
      });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Public delete video generation error:",
        "Failed to delete video generation",
      );
    }
  };

  /**
   * Unified create for every video model. All models run on WaveSpeed via
   * `addVideoGenerationJob`; the queue picks the endpoint from the model
   * config. Form inputs mirror nuvedaai (aspectRatio, negativePrompt,
   * image/lastImage, referenceImages/referenceVideos/referenceAudios,
   * sound/generateAudio); legacy snake_case names are silent aliases.
   */
  private async runCreate(req: Request): Promise<CreateResult> {
    const apiKeyId = getApiKeyId(req);
    const { model = DEFAULT_MODEL_KEY, prompt, duration = 5, mode } = req.body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: "Prompt is required" },
      };
    }

    const modelConfig = MODEL_LOOKUP[model];
    if (!modelConfig) {
      return {
        ok: false,
        status: 400,
        body: {
          success: false,
          error: `Invalid model. Must be one of: ${VALID_MODEL_KEYS.join(", ")}`,
        },
      };
    }
    const seedance = isSeedanceModel(modelConfig);

    const aspectRatio =
      req.body.aspectRatio ??
      req.body.aspect ??
      req.body.aspect_ratio ??
      req.body.ratio ??
      "16:9";
    const negativePrompt = req.body.negativePrompt ?? req.body.negative_prompt;
    const referenceImages = strArray(
      req.body.referenceImages ?? req.body.reference_images ?? req.body.image_files,
    );
    const referenceVideos = strArray(
      req.body.referenceVideos ?? req.body.video_files,
    );
    const referenceAudios = strArray(
      req.body.referenceAudios ?? req.body.audio_files,
    );
    const generateAudio = Boolean(
      req.body.generateAudio ?? req.body.generate_audio,
    );
    const sound = Boolean(req.body.sound ?? (seedance ? generateAudio : false));
    const audio = req.body.audio;
    const startFrame = req.body.startFrame ?? req.body.start_frame;
    const endFrame = req.body.endFrame ?? req.body.end_frame;
    // Legacy Seedance `filePaths: [first, last]` maps onto image/lastImage.
    const legacyFrames = strArray(req.body.filePaths) ?? [];
    const image = req.body.image ?? legacyFrames[0];
    const lastImage = req.body.lastImage ?? req.body.end_image ?? legacyFrames[1];

    if (
      modelConfig.aspectRatio &&
      !modelConfig.aspectRatio.includes(aspectRatio)
    ) {
      return {
        ok: false,
        status: 400,
        body: {
          success: false,
          error: `aspectRatio must be one of: ${modelConfig.aspectRatio.join(", ")}`,
        },
      };
    }

    const dur = Number(duration);
    if (modelConfig.durations?.length) {
      if (!modelConfig.durations.includes(dur)) {
        return {
          ok: false,
          status: 400,
          body: {
            success: false,
            error: `duration must be one of: ${modelConfig.durations.join(", ")} seconds`,
          },
        };
      }
    } else {
      const [minDur, maxDur] = modelConfig.durationRange;
      if (!Number.isInteger(dur) || dur < minDur || dur > maxDur) {
        return {
          ok: false,
          status: 400,
          body: {
            success: false,
            error: `duration must be an integer between ${minDur} and ${maxDur}`,
          },
        };
      }
    }

    if (!seedance && sound && !modelConfig.supportsSound) {
      return {
        ok: false,
        status: 400,
        body: {
          success: false,
          error: `Model ${modelConfig.key} does not support sound`,
        },
      };
    }

    if (negativePrompt && !modelConfig.supportsNegativePrompt) {
      return {
        ok: false,
        status: 400,
        body: {
          success: false,
          error: `Model ${modelConfig.key} does not support negativePrompt`,
        },
      };
    }

    // Resolution: fixed per Seedance variant; selectable where the config
    // lists options (Veo, Wan); ignored otherwise.
    let resolution: string | undefined =
      modelConfig.outputResolution ?? req.body.resolution;
    if (!modelConfig.outputResolution && resolution && modelConfig.resolution) {
      if (!modelConfig.resolution.includes(resolution)) {
        return {
          ok: false,
          status: 400,
          body: {
            success: false,
            error: `resolution must be one of: ${modelConfig.resolution.join(", ")}`,
          },
        };
      }
    }

    const mf = modelConfig.maxFiles;
    if (mf) {
      if (mf.images && referenceImages && referenceImages.length > mf.images) {
        return {
          ok: false,
          status: 400,
          body: {
            success: false,
            error: `referenceImages must contain at most ${mf.images} URLs`,
          },
        };
      }
      if (mf.videos && referenceVideos && referenceVideos.length > mf.videos) {
        return {
          ok: false,
          status: 400,
          body: {
            success: false,
            error: `referenceVideos must contain at most ${mf.videos} URLs`,
          },
        };
      }
      if (mf.audio && referenceAudios && referenceAudios.length > mf.audio) {
        return {
          ok: false,
          status: 400,
          body: {
            success: false,
            error: `referenceAudios must contain at most ${mf.audio} URLs`,
          },
        };
      }
    }

    // Seedance pricing tiers step up when video references are attached;
    // Omni Flash steps up when image references route it to reference-to-video.
    const hasVideoRefs = Boolean(referenceVideos?.length);
    const omniFlashRefs =
      modelConfig.key === "gemini-omni-flash" &&
      Boolean(referenceImages?.length);
    const creditsRequired = modelConfig.credits({
      duration: dur,
      sound: seedance ? hasVideoRefs : omniFlashRefs || sound,
      resolution,
    });

    const user = await resolveUser(req.auth.userId);
    if (!user) {
      return {
        ok: false,
        status: 404,
        body: { success: false, error: "User not found" },
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

    let imageAssetId: string | undefined;
    let endImageAssetId: string | undefined;

    if (image) {
      const a = await createAsset({
        userId: user.id,
        url: image,
        name: "Generation image",
        type: "IMAGE",
        source: "UPLOAD",
      });
      imageAssetId = a.id;
    }
    if (lastImage) {
      const a = await createAsset({
        userId: user.id,
        url: lastImage,
        name: "Generation end image",
        type: "IMAGE",
        source: "UPLOAD",
      });
      endImageAssetId = a.id;
    }

    const functionMode = seedance
      ? image
        ? "FIRST_LAST_FRAMES"
        : "OMNI_REFERENCE"
      : image
        ? "IMAGE_TO_VIDEO"
        : "TEXT_TO_VIDEO";

    const generation = await prisma.generation.create({
      data: {
        userId: user.id,
        model: modelConfig.dbModel,
        prompt: prompt.trim(),
        negativePrompt: negativePrompt?.trim() || null,
        functionMode,
        ratio: aspectRatio,
        duration: dur,
        resolution: resolution || null,
        sound,
        imageAssetId: imageAssetId || null,
        endImageAssetId: endImageAssetId || null,
        creditsUsed: creditsRequired,
        status: "QUEUED",
      },
    });

    const inputAssetEntries: {
      assetId: string;
      role: "IMAGE_FILE" | "VIDEO_FILE" | "AUDIO_FILE" | "FRAME_PATH";
      order: number;
    }[] = [];

    const refEntries: {
      urls: string[] | undefined;
      role: "IMAGE_FILE" | "VIDEO_FILE" | "AUDIO_FILE";
      type: "IMAGE" | "VIDEO" | "AUDIO";
      label: string;
    }[] = [
      { urls: referenceImages, role: "IMAGE_FILE", type: "IMAGE", label: "Reference image" },
      { urls: referenceVideos, role: "VIDEO_FILE", type: "VIDEO", label: "Reference video" },
      { urls: referenceAudios, role: "AUDIO_FILE", type: "AUDIO", label: "Reference audio" },
    ];

    for (const entry of refEntries) {
      if (!entry.urls?.length) continue;
      for (let i = 0; i < entry.urls.length; i++) {
        const asset = await createAsset({
          userId: user.id,
          url: entry.urls[i],
          name: `${entry.label} ${i + 1}`,
          type: entry.type,
          source: "UPLOAD",
        });
        inputAssetEntries.push({ assetId: asset.id, role: entry.role, order: i });
      }
    }

    if (audio) {
      const asset = await createAsset({
        userId: user.id,
        url: audio,
        name: "Audio file",
        type: "AUDIO",
        source: "UPLOAD",
      });
      inputAssetEntries.push({ assetId: asset.id, role: "AUDIO_FILE", order: 0 });
    }

    const frames = [startFrame, endFrame].filter(Boolean);
    for (let i = 0; i < frames.length; i++) {
      const asset = await createAsset({
        userId: user.id,
        url: frames[i],
        name: `Frame ${i + 1}`,
        type: "IMAGE",
        source: "UPLOAD",
      });
      inputAssetEntries.push({ assetId: asset.id, role: "FRAME_PATH", order: i });
    }

    if (inputAssetEntries.length > 0) {
      await prisma.generationInputAsset.createMany({
        data: inputAssetEntries.map((e) => ({
          generationId: generation.id,
          assetId: e.assetId,
          role: e.role,
          order: e.order,
        })),
      });
    }

    // Set once credits are taken, so a failed enqueue can hand them back.
    let consumedTxnId: string | undefined;
    try {
      const consumption = await consumeCredits({
        userId: user.id,
        amount: creditsRequired,
        reason: seedance ? "video.generation.seedance" : "video.generation",
        apiKeyId,
        metadata: { generationId: generation.id, model: modelConfig.dbModel },
      });
      consumedTxnId = consumption.transactionId;

      await addVideoGenerationJob({
        userId: user.id,
        generationId: generation.id,
        creditsUsed: creditsRequired,
        creditTransactionId: consumption.transactionId,
        modelKey: modelConfig.key,
        prompt: prompt.trim(),
        negativePrompt: negativePrompt?.trim(),
        aspectRatio,
        duration: dur,
        resolution,
        sound,
        mode,
        image,
        endImage: lastImage,
        referenceImages,
        referenceVideos,
        referenceAudios,
        generateAudio,
        startFrame,
        endFrame,
        audio,
      });

      return {
        ok: true,
        body: {
          success: true,
          generation: { id: generation.id, status: "QUEUED" },
          model: modelConfig.key,
          creditsDeducted: creditsRequired,
          creditsRemaining: consumption.balanceAfter,
        },
      };
    } catch (err) {
      if (consumedTxnId) {
        await refundConsumption(consumedTxnId, "video.generation.enqueue_failed", {
          generationId: generation.id,
        }).catch((refundError) =>
          console.error(
            `[v1] Refund after failed enqueue for ${generation.id} failed:`,
            refundError,
          ),
        );
      }
      await prisma.generation
        .delete({ where: { id: generation.id } })
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
  }
}
