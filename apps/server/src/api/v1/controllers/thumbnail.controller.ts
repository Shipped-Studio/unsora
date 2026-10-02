import { Request, Response } from "express";
import prisma from "../../../lib/db";
import { gptImage2 } from "../../../config/models";
import { ImageGenerationType } from "@prisma/client";
import { createAsset } from "../../../lib/asset-utils";
import {
  consumeCredits,
  getCreditBalance,
  InsufficientCreditsError,
} from "../../../lib/credits";
import { addThumbnailGenerationJob } from "../../../queue/thumbnail.queue";
import {
  THUMB_CREDIT_PER_OUTPUT,
  THUMB_MAX_TEMPLATES,
  THUMB_MAX_VARIATIONS,
} from "../../../config/models/thumbnail-generator";
import { getApiKeyId, mergeApiContext } from "../../../lib/api-public";
import { withPublicCreate } from "../helpers/public-create";
import { handlePublicError } from "../helpers/public-response";

const THUMB_RATIO = "16:9";
const THUMB_RESOLUTION = "2k";

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

function parseUrlList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((u): u is string => typeof u === "string" && u.length > 0);
}

async function attachReferenceAssets(
  userId: string,
  generationId: string,
  urls: string[],
) {
  if (urls.length === 0) return;

  const refAssets = await Promise.all(
    urls.map((url, i) =>
      createAsset({
        userId,
        url,
        name: `Thumbnail reference ${i + 1}`,
        type: "IMAGE",
        source: "UPLOAD",
      }),
    ),
  );

  await prisma.imageGenerationRefAsset.createMany({
    data: refAssets.map((a, i) => ({
      imageGenerationId: generationId,
      assetId: a.id,
      order: i,
    })),
  });
}

type CreateResult =
  | { ok: false; status: number; body: Record<string, unknown> }
  | { ok: true; body: Record<string, unknown> };

function mapThumbnailRecord(g: {
  id: string;
  userId: string;
  prompt: string | null;
  taskId: string | null;
  status: string;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  outputAsset: { url: string } | null;
}) {
  return {
    id: g.id,
    userId: g.userId,
    title: g.prompt?.trim() || null,
    description: null,
    image: g.outputAsset?.url ?? "",
    link: null,
    jobId: g.taskId,
    status: g.status,
    error: g.error,
    completedAt: g.status === "COMPLETED" ? g.updatedAt.toISOString() : null,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}

export class PublicThumbnailController {
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
      console.error("Public create thumbnail error:", error);
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

      const where = {
        userId: user.id,
        type: ImageGenerationType.THUMBNAIL,
      };

      const [generations, totalCount] = await Promise.all([
        prisma.imageGeneration.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          include: { outputAsset: true },
        }),
        prisma.imageGeneration.count({ where }),
      ]);

      const data = generations.map(mapThumbnailRecord);

      const totalPages = Math.ceil(totalCount / limit) || 1;

      return res.json({
        success: true,
        data,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages,
        },
      });
    } catch (error) {
      console.error("Get thumbnails error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
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

      const generation = await prisma.imageGeneration.findFirst({
        where: {
          id: generationId,
          userId: user.id,
          type: ImageGenerationType.THUMBNAIL,
        },
        include: { outputAsset: true },
      });

      if (!generation) {
        return res
          .status(404)
          .json({ success: false, error: "Thumbnail not found" });
      }

      return res.json({ success: true, data: mapThumbnailRecord(generation) });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Public get thumbnail error:",
        "Failed to fetch thumbnail",
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

      const deleted = await prisma.imageGeneration.deleteMany({
        where: {
          id: generationId,
          userId: user.id,
          type: ImageGenerationType.THUMBNAIL,
        },
      });

      if (deleted.count === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Thumbnail not found" });
      }

      return res.json({
        success: true,
        message: "Thumbnail deleted successfully",
      });
    } catch (error) {
      console.error("Delete thumbnail error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  };

  private async runCreate(req: Request): Promise<CreateResult> {
    const apiKeyId = getApiKeyId(req);

    const {
      prompt = "",
      referenceImageUrls = [],
      templateImageUrls = [],
      context: rawContext,
      expression: rawExpression = "auto",
      variations = 1,
    } = req.body;

    const variationCount = Math.min(
      Math.max(parseInt(String(variations), 10) || 1, 1),
      THUMB_MAX_VARIATIONS,
    );

    const normalizedContext = Array.isArray(rawContext) ? rawContext : [];

    const templateUrls = parseUrlList(templateImageUrls);
    if (templateUrls.length > THUMB_MAX_TEMPLATES) {
      return {
        ok: false,
        status: 400,
        body: {
          success: false,
          error: "Only one template can be selected per generation.",
        },
      };
    }

    const templateUrl = templateUrls[0] ?? null;
    const userRefUrls = parseUrlList(referenceImageUrls).filter(
      (url) => url !== templateUrl,
    );
    const referenceUrls = templateUrl
      ? [...userRefUrls, templateUrl]
      : userRefUrls;

    const maxRefs = gptImage2.maxRefs ?? 16;
    if (referenceUrls.length > maxRefs) {
      return {
        ok: false,
        status: 400,
        body: {
          success: false,
          error: `Maximum of ${maxRefs} reference images allowed`,
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

    const creditPerJob = THUMB_CREDIT_PER_OUTPUT;
    const totalCredits = variationCount * creditPerJob;
    const balance = await getCreditBalance(user.id);

    if (balance < totalCredits) {
      return {
        ok: false,
        status: 402,
        body: {
          success: false,
          error: `Insufficient credits. Need ${totalCredits}, have ${balance}`,
          creditsRemaining: balance,
        },
      };
    }

    const trimmedPrompt = typeof prompt === "string" ? prompt.trim() : "";
    const expression =
      typeof rawExpression === "string" ? rawExpression : "auto";

    if (
      !trimmedPrompt &&
      normalizedContext.length === 0 &&
      referenceUrls.length === 0
    ) {
      return {
        ok: false,
        status: 400,
        body: {
          success: false,
          error: "Provide a prompt, context, or reference images.",
        },
      };
    }

    const created: { id: string; status: string }[] = [];
    let creditsRemaining = balance;

    for (
      let variationIndex = 0;
      variationIndex < variationCount;
      variationIndex++
    ) {
      const params = mergeApiContext(
        {
          expression,
          variationIndex,
          templateImageUrl: templateUrl,
          context: normalizedContext,
          hasTemplateReference: templateUrl != null,
        },
        { apiKeyId },
      );

      const generation = await prisma.imageGeneration.create({
        data: {
          userId: user.id,
          model: gptImage2.dbModel,
          prompt: trimmedPrompt,
          ratio: THUMB_RATIO,
          resolution: THUMB_RESOLUTION,
          type: ImageGenerationType.THUMBNAIL,
          creditsUsed: creditPerJob,
          status: "QUEUED",
          params,
        },
      });

      await attachReferenceAssets(user.id, generation.id, referenceUrls);

      let creditTransactionId: string;
      try {
        const consumption = await consumeCredits({
          userId: user.id,
          amount: creditPerJob,
          reason: "thumbnail.generation",
          apiKeyId,
          metadata: { generationId: generation.id },
        });
        creditTransactionId = consumption.transactionId;
        creditsRemaining = consumption.balanceAfter;
      } catch (err) {
        await prisma.imageGeneration
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
              generations: created,
            },
          };
        }
        throw err;
      }

      await addThumbnailGenerationJob({
        userId: user.id,
        generationId: generation.id,
        creditsUsed: creditPerJob,
        creditTransactionId,
        prompt: trimmedPrompt,
        ratio: THUMB_RATIO,
        resolution: THUMB_RESOLUTION,
        referenceImageUrls: referenceUrls,
        modelKey: gptImage2.key,
        rawContext: normalizedContext,
        expression,
        hasTemplateReference: templateUrl != null,
      });

      created.push({ id: generation.id, status: "QUEUED" });
    }

    return {
      ok: true,
      body: {
        success: true,
        generations: created,
        creditsDeducted: created.length * creditPerJob,
        creditsRemaining,
      },
    };
  }
}
