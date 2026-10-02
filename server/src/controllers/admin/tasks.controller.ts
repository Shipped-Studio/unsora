import type { Request, Response } from "express";
import prisma from "../../lib/db";
import { FEED_SELECT, FEED_KINDS, num, toPositiveInt } from "./_shared";

interface FeedRow {
  id: string;
  kind: string;
  userId: string;
  status: string;
  credits: number;
  model: string | null;
  label: string | null;
  error: string | null;
  createdAt: Date;
}

const VALID_STATUS = new Set([
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);

/**
 * GET /api/admin/tasks
 *   ?page=1&limit=30&kind=&status=&userId=&search=
 *
 * The unified activity feed — every generation across every feature, newest
 * first, with the owning user's email joined in.
 */
export class AdminTasksController {
  async list(req: Request, res: Response) {
    try {
      const page = toPositiveInt(req.query.page, 1, 100000);
      const limit = toPositiveInt(req.query.limit, 30, 100);
      const offset = (page - 1) * limit;

      const kind =
        req.query.kind &&
        (FEED_KINDS as readonly string[]).includes(String(req.query.kind))
          ? String(req.query.kind)
          : null;
      const status = VALID_STATUS.has(String(req.query.status).toUpperCase())
        ? String(req.query.status).toUpperCase()
        : null;
      const userId = req.query.userId ? String(req.query.userId) : null;
      const search = String(req.query.search ?? "").trim() || null;

      // Search matches the owning user's email. The feed has no email column,
      // so resolve the search term to matching user IDs first, then filter the
      // feed by userId. A search that matches no user yields an empty page.
      let emailUserIds: string[] | null = null;
      if (search) {
        const matches = await prisma.user.findMany({
          where: { email: { contains: search, mode: "insensitive" } },
          select: { id: true },
        });
        emailUserIds = matches.map((u) => u.id);
        if (emailUserIds.length === 0) {
          return res.json({
            success: true,
            data: {
              tasks: [],
              pagination: { page, limit, total: 0, totalPages: 1 },
            },
          });
        }
      }

      // Params: $1 kind, $2 status, $3 userId, $4 email userIds, then limit/offset.
      const filterSql = `
        WHERE ($1::text IS NULL OR kind = $1)
          AND ($2::text IS NULL OR status = $2)
          AND ($3::text IS NULL OR "userId" = $3)
          AND ($4::text[] IS NULL OR "userId" = ANY($4::text[]))`;

      const [rows, countRows] = await Promise.all([
        prisma.$queryRawUnsafe<FeedRow[]>(
          `WITH feed AS (${FEED_SELECT})
           SELECT id, kind, "userId", status, credits, model, label, error, "createdAt"
           FROM feed ${filterSql}
           ORDER BY "createdAt" DESC
           LIMIT $5 OFFSET $6`,
          kind,
          status,
          userId,
          emailUserIds,
          limit,
          offset,
        ),
        prisma.$queryRawUnsafe<{ count: bigint }[]>(
          `WITH feed AS (${FEED_SELECT})
           SELECT COUNT(*)::int AS count FROM feed ${filterSql}`,
          kind,
          status,
          userId,
          emailUserIds,
        ),
      ]);

      // Join owner emails in one lookup.
      const userIds = [...new Set(rows.map((r) => r.userId))];
      const users = userIds.length
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true },
          })
        : [];
      const emailMap = new Map(users.map((u) => [u.id, u.email]));

      const total = num(countRows[0]?.count);
      return res.json({
        success: true,
        data: {
          tasks: rows.map((r) => ({
            id: r.id,
            kind: r.kind,
            userId: r.userId,
            userEmail: emailMap.get(r.userId) ?? null,
            status: r.status,
            credits: num(r.credits),
            model: r.model,
            label: r.label,
            error: r.error,
            createdAt: r.createdAt,
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
      console.error("[admin] tasks.list error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load tasks" });
    }
  }
}

export const adminTasksController = new AdminTasksController();
