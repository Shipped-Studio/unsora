import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../../lib/db";
import { getCreditBalance, adjustCredits } from "../../lib/credits";
import { FEED_SELECT, num, toPositiveInt } from "./_shared";

const SORTABLE = new Set(["createdAt", "email", "plan", "status", "updatedAt"]);

/**
 * Admin user management: list (search / filter / sort / paginate), full
 * detail, plan & status updates, and manual credit adjustments.
 */
export class AdminUsersController {
  /**
   * GET /api/admin/users
   *   ?page=1&limit=25&search=&plan=&status=&role=&active=&sort=createdAt&order=desc
   */
  async list(req: Request, res: Response) {
    try {
      const page = toPositiveInt(req.query.page, 1, 100000);
      const limit = toPositiveInt(req.query.limit, 25, 100);
      const search = String(req.query.search ?? "").trim();
      const sort = SORTABLE.has(String(req.query.sort))
        ? String(req.query.sort)
        : "createdAt";
      const order = String(req.query.order) === "asc" ? "asc" : "desc";

      const where: Prisma.UserWhereInput = {};
      if (search) where.email = { contains: search, mode: "insensitive" };
      if (req.query.plan) where.plan = String(req.query.plan);
      if (req.query.status) where.status = String(req.query.status);
      if (req.query.role === "ADMIN" || req.query.role === "USER") {
        where.role = req.query.role;
      }
      if (req.query.active === "true") where.isActive = true;
      if (req.query.active === "false") where.isActive = false;

      const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          orderBy: { [sort]: order },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            clerkId: true,
            email: true,
            role: true,
            plan: true,
            isActive: true,
            isCancelled: true,
            status: true,
            stripeCurrentPeriodEnd: true,
            createdAt: true,
          },
        }),
      ]);

      const ids = users.map((u) => u.id);
      const [accountCounts, balances, taskCounts] = await Promise.all([
        ids.length
          ? prisma.socialAccount.groupBy({
              by: ["userId"],
              where: { userId: { in: ids } },
              _count: { _all: true },
            })
          : [],
        ids.length ? this.balancesFor(ids) : new Map<string, number>(),
        ids.length ? this.taskCountsFor(ids) : new Map<string, number>(),
      ]);

      const accountMap = new Map<string, number>(
        accountCounts.map((a) => [a.userId, num(a._count._all)] as const),
      );

      return res.json({
        success: true,
        data: {
          users: users.map((u) => ({
            ...u,
            credits: balances.get(u.id) ?? 0,
            connectedAccounts: accountMap.get(u.id) ?? 0,
            taskCount: taskCounts.get(u.id) ?? 0,
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
      console.error("[admin] users.list error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load users" });
    }
  }

  /** GET /api/admin/users/:id — full profile with related activity. */
  async detail(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          clerkId: true,
          email: true,
          role: true,
          plan: true,
          isActive: true,
          isCancelled: true,
          status: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          stripePriceId: true,
          stripeCurrentPeriodEnd: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const [
        credits,
        socialAccounts,
        creditGrants,
        creditTransactions,
        postCount,
        assetCount,
        kindRows,
        recentTasks,
      ] = await Promise.all([
        getCreditBalance(id),
        prisma.socialAccount.findMany({
          where: { userId: id },
          select: {
            id: true,
            provider: true,
            accountName: true,
            accountUsername: true,
            profilePicture: true,
            expiresAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.creditGrant.findMany({
          where: { userId: id },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.creditTransaction.findMany({
          where: { userId: id },
          orderBy: { createdAt: "desc" },
          take: 25,
          select: {
            id: true,
            type: true,
            amount: true,
            reason: true,
            createdAt: true,
          },
        }),
        prisma.post.count({ where: { userId: id } }),
        prisma.asset.count({ where: { userId: id } }),
        prisma.$queryRawUnsafe<{ kind: string; count: bigint }[]>(
          `WITH feed AS (${FEED_SELECT})
           SELECT kind, COUNT(*)::int AS count FROM feed
           WHERE "userId" = $1 GROUP BY kind`,
          id,
        ),
        prisma.$queryRawUnsafe<
          {
            id: string;
            kind: string;
            status: string;
            credits: number;
            model: string | null;
            label: string | null;
            error: string | null;
            createdAt: Date;
          }[]
        >(
          `WITH feed AS (${FEED_SELECT})
           SELECT id, kind, status, credits, model, label, error, "createdAt"
           FROM feed WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 20`,
          id,
        ),
      ]);

      return res.json({
        success: true,
        data: {
          user,
          credits,
          socialAccounts,
          creditGrants,
          creditTransactions,
          counts: {
            posts: postCount,
            assets: assetCount,
            tasks: kindRows.reduce((s, r) => s + num(r.count), 0),
          },
          kindCounts: kindRows
            .map((r) => ({ kind: r.kind, count: num(r.count) }))
            .sort((a, b) => b.count - a.count),
          recentTasks: recentTasks.map((t) => ({
            ...t,
            credits: num(t.credits),
          })),
        },
      });
    } catch (error) {
      console.error("[admin] users.detail error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load user" });
    }
  }

  /** PATCH /api/admin/users/:id — update plan / status / flags / role. */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const body = req.body ?? {};
      const data: Prisma.UserUpdateInput = {};

      if (typeof body.plan === "string") data.plan = body.plan;
      if (typeof body.status === "string") data.status = body.status;
      if (typeof body.isActive === "boolean") data.isActive = body.isActive;
      if (typeof body.isCancelled === "boolean")
        data.isCancelled = body.isCancelled;
      if (body.role === "ADMIN" || body.role === "USER") data.role = body.role;

      if (Object.keys(data).length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "No valid fields to update" });
      }

      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const user = await prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          email: true,
          role: true,
          plan: true,
          isActive: true,
          isCancelled: true,
          status: true,
        },
      });

      return res.json({ success: true, data: { user } });
    } catch (error) {
      console.error("[admin] users.update error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to update user" });
    }
  }

  /** POST /api/admin/users/:id/credits — grant (+) or deduct (-) credits. */
  async adjustCredits(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const delta = parseInt(String(req.body?.delta), 10);
      const reason = String(req.body?.reason ?? "").trim() || "admin:manual";

      if (Number.isNaN(delta) || delta === 0) {
        return res
          .status(400)
          .json({ success: false, error: "delta must be a non-zero integer" });
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      await adjustCredits({
        userId: id,
        delta,
        reason: `admin:${reason}`,
        metadata: { adjustedBy: req.auth?.userId ?? "admin" },
      });

      const credits = await getCreditBalance(id);
      return res.json({ success: true, data: { credits } });
    } catch (error) {
      console.error("[admin] users.adjustCredits error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to adjust credits" });
    }
  }

  /** Live credit balance per user (non-expired grants), keyed by userId. */
  private async balancesFor(ids: string[]): Promise<Map<string, number>> {
    const rows = await prisma.$queryRaw<
      { userId: string; balance: bigint }[]
    >`SELECT "userId", COALESCE(SUM(amount - used), 0) AS balance
      FROM credit_grants
      WHERE "userId" IN (${Prisma.join(ids)})
        AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
      GROUP BY "userId"`;
    return new Map<string, number>(
      rows.map((r) => [r.userId, num(r.balance)] as const),
    );
  }

  /** Total task count per user across the unified feed, keyed by userId. */
  private async taskCountsFor(ids: string[]): Promise<Map<string, number>> {
    const rows = await prisma.$queryRawUnsafe<
      { userId: string; count: bigint }[]
    >(
      `WITH feed AS (${FEED_SELECT})
       SELECT "userId", COUNT(*)::int AS count FROM feed
       WHERE "userId" IN (${ids.map((_, i) => `$${i + 1}`).join(",")})
       GROUP BY "userId"`,
      ...ids,
    );
    return new Map<string, number>(
      rows.map((r) => [r.userId, num(r.count)] as const),
    );
  }
}

export const adminUsersController = new AdminUsersController();
