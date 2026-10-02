import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../../lib/db";
import { toPositiveInt, num } from "./_shared";

const VALID_TYPES = new Set(["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"]);

/**
 * GET /api/admin/content
 *   ?page=1&limit=40&type=IMAGE|VIDEO|AUDIO|DOCUMENT&source=GENERATION&userId=
 *
 * A gallery of the actual media users produced — reads the Asset table
 * (default: generated assets) so the admin can eyeball WHAT is being made,
 * not just that a task ran.
 */
export class AdminContentController {
  async list(req: Request, res: Response) {
    try {
      const page = toPositiveInt(req.query.page, 1, 100000);
      const limit = toPositiveInt(req.query.limit, 40, 100);

      const where: Prisma.AssetWhereInput = {};
      const type = String(req.query.type ?? "").toUpperCase();
      if (VALID_TYPES.has(type)) where.type = type as Prisma.AssetWhereInput["type"];

      // Default to generated content; allow ?source=ALL to see everything.
      const source = String(req.query.source ?? "GENERATION").toUpperCase();
      if (source !== "ALL") {
        where.source = source as Prisma.AssetWhereInput["source"];
      }
      if (req.query.userId) where.userId = String(req.query.userId);

      const [total, assets, typeGroups] = await Promise.all([
        prisma.asset.count({ where }),
        prisma.asset.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            name: true,
            url: true,
            mimeType: true,
            type: true,
            source: true,
            width: true,
            height: true,
            duration: true,
            createdAt: true,
            user: { select: { id: true, email: true } },
          },
        }),
        prisma.asset.groupBy({
          by: ["type"],
          where:
            source !== "ALL"
              ? { source: where.source }
              : undefined,
          _count: { _all: true },
        }),
      ]);

      return res.json({
        success: true,
        data: {
          assets,
          typeCounts: typeGroups.map((g) => ({
            type: g.type,
            count: num(g._count._all),
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
          },
        },
      });
    } catch (error) {
      console.error("[admin] content.list error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load content" });
    }
  }
}

export const adminContentController = new AdminContentController();
