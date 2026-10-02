import { Request, Response } from "express";
import { prisma } from "../lib/db";
import { analyticsService } from "../services/analytics.service";

export class AnalyticsController {
  /**
   * GET /api/posts/analytics/summary?days=30
   * Aggregated metrics for the user's published posts.
   */
  async getSummary(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;
      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const days = Math.min(
        90,
        Math.max(7, parseInt(String(req.query.days)) || 30),
      );

      const summary = await analyticsService.getSummary(user.id, days);

      return res.json({ success: true, data: { days, ...summary } });
    } catch (error) {
      console.error("Error building analytics summary:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load analytics" });
    }
  }

  /**
   * POST /api/posts/analytics/refresh
   * Poll platforms for fresh metrics for this user's posts, then return
   * how many posts were refreshed. The client refetches the summary after.
   */
  async refresh(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;
      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const refreshed = await analyticsService.refreshUserMetrics(user.id);

      return res.json({ success: true, data: { refreshed } });
    } catch (error) {
      console.error("Error refreshing analytics:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to refresh analytics" });
    }
  }
}

export const analyticsController = new AnalyticsController();
