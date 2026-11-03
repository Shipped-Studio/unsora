import type { Request, Response } from "express";
import prisma from "../../lib/db";
import { allHeardFrom } from "../../lib/heard-from";
import { FEED_SELECT, num, toPositiveInt } from "./_shared";

interface DayCount {
  date: string;
  count: number;
}

interface SourceRow {
  source: string;
  signups: number;
  /** Signed up in the range and now on a plan or trial. */
  startedPlan: number;
}

/** Sign-ups who skipped "How did you hear about Unsora?". */
const NO_ANSWER = "Didn't answer";

/**
 * GET /api/admin/overview?days=30
 *
 * The landing view of the admin dashboard: headline KPIs, task-status and
 * per-feature breakdowns, connected-account providers, and daily time series
 * for new users / tasks / credit consumption, and where the range's
 * sign-ups heard about Unsora.
 */
export class AdminOverviewController {
  async get(req: Request, res: Response) {
    try {
      const days = toPositiveInt(req.query.days, 30, 90);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        activeUsers,
        paidUsers,
        newUsers7d,
        newUsers30d,
        connectedAccounts,
        providerGroups,
        assetGroups,
        creditsConsumedAgg,
        taskAggRows,
        kindRows,
        newUserSeries,
        taskSeries,
        creditSeries,
        sources,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({
          where: { plan: { not: null, notIn: ["free"] } },
        }),
        prisma.user.count({ where: { createdAt: { gte: last7d } } }),
        prisma.user.count({ where: { createdAt: { gte: since } } }),
        prisma.socialAccount.count(),
        prisma.socialAccount.groupBy({
          by: ["provider"],
          _count: { _all: true },
        }),
        prisma.asset.groupBy({ by: ["type"], _count: { _all: true } }),
        prisma.creditTransaction.aggregate({
          where: { type: "CONSUMPTION" },
          _sum: { amount: true },
        }),
        // Task status distribution + total + last-24h count, one pass.
        prisma.$queryRawUnsafe<
          { status: string; count: bigint }[]
        >(`WITH feed AS (${FEED_SELECT})
           SELECT status, COUNT(*)::int AS count FROM feed GROUP BY status`),
        prisma.$queryRawUnsafe<{ kind: string; count: bigint }[]>(
          `WITH feed AS (${FEED_SELECT})
           SELECT kind, COUNT(*)::int AS count FROM feed GROUP BY kind`,
        ),
        this.dailySeries("users", days),
        this.dailyFeedSeries(days),
        this.dailyCreditsSeries(days),
        // Answers live in Clerk; if it's unreachable the rest still loads.
        this.signupSources(since).catch((error) => {
          console.error("[admin] overview sources error:", error);
          return null;
        }),
      ]);

      const tasks24hRow = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `WITH feed AS (${FEED_SELECT})
         SELECT COUNT(*)::int AS count FROM feed WHERE "createdAt" >= $1`,
        last24h,
      );

      const taskStatus = taskAggRows.map((r) => ({
        status: r.status,
        count: num(r.count),
      }));
      const totalTasks = taskStatus.reduce((s, r) => s + r.count, 0);
      const statusOf = (s: string) =>
        taskStatus.find((r) => r.status === s)?.count ?? 0;

      return res.json({
        success: true,
        data: {
          days,
          kpis: {
            totalUsers,
            activeUsers,
            paidUsers,
            newUsers7d,
            newUsers30d,
            connectedAccounts,
            totalTasks,
            tasks24h: num(tasks24hRow[0]?.count),
            completedTasks: statusOf("COMPLETED"),
            failedTasks: statusOf("FAILED"),
            processingTasks: statusOf("PROCESSING") + statusOf("QUEUED"),
            creditsConsumed: Math.abs(num(creditsConsumedAgg._sum.amount)),
            totalAssets: assetGroups.reduce(
              (s, g) => s + num(g._count._all),
              0,
            ),
          },
          taskStatus,
          kindCounts: kindRows
            .map((r) => ({ kind: r.kind, count: num(r.count) }))
            .sort((a, b) => b.count - a.count),
          providers: providerGroups
            .map((g) => ({ provider: g.provider, count: num(g._count._all) }))
            .sort((a, b) => b.count - a.count),
          assetTypes: assetGroups.map((g) => ({
            type: g.type,
            count: num(g._count._all),
          })),
          series: {
            newUsers: newUserSeries,
            tasks: taskSeries,
            credits: creditSeries,
          },
          sources,
        },
      });
    } catch (error) {
      console.error("[admin] overview error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load overview" });
    }
  }

  /** Sign-ups since `since`, grouped by their onboarding answer, most first. */
  private async signupSources(since: Date): Promise<SourceRow[]> {
    const [answers, users] = await Promise.all([
      allHeardFrom(),
      prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { clerkId: true, plan: true, isActive: true },
      }),
    ]);
    const rows = new Map<string, SourceRow>();
    for (const user of users) {
      const source = answers.get(user.clerkId) ?? NO_ANSWER;
      const row = rows.get(source) ?? { source, signups: 0, startedPlan: 0 };
      row.signups += 1;
      if (user.isActive && user.plan && user.plan !== "free") row.startedPlan += 1;
      rows.set(source, row);
    }
    // Answers first by size; "Didn't answer" last.
    return [...rows.values()].sort(
      (a, b) =>
        Number(a.source === NO_ANSWER) - Number(b.source === NO_ANSWER) ||
        b.signups - a.signups,
    );
  }

  /** Daily row counts for a table with a `createdAt` column, gaps filled with 0. */
  private async dailySeries(
    table: "users",
    days: number,
  ): Promise<DayCount[]> {
    const rows = await prisma.$queryRawUnsafe<{ date: string; count: bigint }[]>(
      `SELECT to_char(d, 'YYYY-MM-DD') AS date, COUNT(t.id)::int AS count
       FROM generate_series(
         (CURRENT_DATE - ${days - 1})::timestamp, CURRENT_DATE::timestamp, '1 day'
       ) d
       LEFT JOIN ${table} t ON date_trunc('day', t."createdAt") = d
       GROUP BY d ORDER BY d`,
    );
    return rows.map((r) => ({ date: r.date, count: num(r.count) }));
  }

  /** Daily task counts across the unified feed. */
  private async dailyFeedSeries(days: number): Promise<DayCount[]> {
    const rows = await prisma.$queryRawUnsafe<{ date: string; count: bigint }[]>(
      `WITH feed AS (${FEED_SELECT})
       SELECT to_char(d, 'YYYY-MM-DD') AS date, COUNT(f.id)::int AS count
       FROM generate_series(
         (CURRENT_DATE - ${days - 1})::timestamp, CURRENT_DATE::timestamp, '1 day'
       ) d
       LEFT JOIN feed f ON date_trunc('day', f."createdAt") = d
       GROUP BY d ORDER BY d`,
    );
    return rows.map((r) => ({ date: r.date, count: num(r.count) }));
  }

  /** Daily credits consumed (absolute value of CONSUMPTION transactions). */
  private async dailyCreditsSeries(days: number): Promise<DayCount[]> {
    const rows = await prisma.$queryRawUnsafe<{ date: string; count: bigint }[]>(
      `SELECT to_char(d, 'YYYY-MM-DD') AS date,
              COALESCE(ABS(SUM(t.amount)), 0)::int AS count
       FROM generate_series(
         (CURRENT_DATE - ${days - 1})::timestamp, CURRENT_DATE::timestamp, '1 day'
       ) d
       LEFT JOIN credit_transactions t
         ON date_trunc('day', t."createdAt") = d AND t.type = 'CONSUMPTION'
       GROUP BY d ORDER BY d`,
    );
    return rows.map((r) => ({ date: r.date, count: num(r.count) }));
  }
}

export const adminOverviewController = new AdminOverviewController();
