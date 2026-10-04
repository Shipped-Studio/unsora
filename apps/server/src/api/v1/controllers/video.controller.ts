import { Request, Response } from "express";
import prisma from "../../../lib/db";
import { VIDEO_MODELS } from "../../../config/models";
import { CATALOG, catalogDbModels } from "../../../config/catalog";
import { handlePublicError } from "../helpers/public-response";

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

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

export class PublicVideoController {
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

}
