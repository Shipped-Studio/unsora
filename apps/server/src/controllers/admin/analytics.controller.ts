import type { Request, Response } from "express";
import prisma from "../../lib/db";
import { FEED_SELECT, FEED_KINDS, num, toPositiveInt } from "./_shared";

/**
 * GET /api/admin/analytics?days=30
 *
 * Feature-usage deep dive: which features are used, their completion/failure
 * rates, credits burned per feature, the most-used models, and a per-feature
 * daily time series for a stacked-area view.
 */
export class AdminAnalyticsController {
  async get(req: Request, res: Response) {
    try {
      const days = toPositiveInt(req.query.days, 30, 90);

      const kindsArray = `ARRAY[${FEED_KINDS.map((k) => `'${k}'`).join(",")}]`;

      const [byKind, statusTotals, topModels, series] = await Promise.all([
        prisma.$queryRawUnsafe<
          {
            kind: string;
            total: bigint;
            completed: bigint;
            failed: bigint;
            processing: bigint;
            credits: bigint;
          }[]
        >(`WITH feed AS (${FEED_SELECT})
           SELECT kind,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
             COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed,
             COUNT(*) FILTER (WHERE status IN ('QUEUED','PROCESSING'))::int AS processing,
             COALESCE(SUM(credits), 0)::int AS credits
           FROM feed GROUP BY kind`),

        prisma.$queryRawUnsafe<{ status: string; count: bigint }[]>(
          `WITH feed AS (${FEED_SELECT})
           SELECT status, COUNT(*)::int AS count FROM feed GROUP BY status`,
        ),

        prisma.$queryRawUnsafe<{ model: string; count: bigint }[]>(
          `WITH feed AS (${FEED_SELECT})
           SELECT model, COUNT(*)::int AS count FROM feed
           WHERE model IS NOT NULL AND model <> ''
           GROUP BY model ORDER BY count DESC LIMIT 15`,
        ),

        // Per-kind daily grid (gap-filled) for a stacked-area chart.
        prisma.$queryRawUnsafe<
          { date: string; kind: string; count: bigint }[]
        >(`WITH feed AS (${FEED_SELECT})
           SELECT to_char(d, 'YYYY-MM-DD') AS date, k.kind, COUNT(f.id)::int AS count
           FROM generate_series(
             (CURRENT_DATE - ${days - 1})::timestamp, CURRENT_DATE::timestamp, '1 day'
           ) d
           CROSS JOIN (SELECT unnest(${kindsArray}) AS kind) k
           LEFT JOIN feed f
             ON date_trunc('day', f."createdAt") = d AND f.kind = k.kind
           GROUP BY d, k.kind ORDER BY d`),
      ]);

      // Pivot the series grid into [{ date, video: n, image: n, ... }].
      const pivot = new Map<string, Record<string, number>>();
      for (const row of series) {
        const entry = pivot.get(row.date) ?? { };
        entry[row.kind] = num(row.count);
        pivot.set(row.date, entry);
      }
      const seriesByKind = [...pivot.entries()].map(([date, kinds]) => ({
        date,
        ...kinds,
      }));

      return res.json({
        success: true,
        data: {
          days,
          byKind: byKind
            .map((r) => ({
              kind: r.kind,
              total: num(r.total),
              completed: num(r.completed),
              failed: num(r.failed),
              processing: num(r.processing),
              credits: num(r.credits),
              successRate:
                num(r.total) > 0
                  ? Math.round((num(r.completed) / num(r.total)) * 100)
                  : 0,
            }))
            .sort((a, b) => b.total - a.total),
          statusTotals: statusTotals.map((r) => ({
            status: r.status,
            count: num(r.count),
          })),
          topModels: topModels.map((r) => ({
            model: r.model,
            count: num(r.count),
          })),
          seriesByKind,
        },
      });
    } catch (error) {
      console.error("[admin] analytics error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load analytics" });
    }
  }
}

export const adminAnalyticsController = new AdminAnalyticsController();
