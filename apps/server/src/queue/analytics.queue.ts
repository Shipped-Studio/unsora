import { schedules } from "@trigger.dev/sdk";
import { analyticsService } from "../services/analytics.service";

/**
 * Scheduled task: poll TikTok/Instagram engagement metrics for recently
 * published posts. Platforms don't push metric counts over webhooks, so
 * polling is the only way to keep analytics current.
 */
export const postMetricsCron = schedules.task({
  id: "post-metrics-refresh",
  // Every 6 hours — frequent enough for a daily-granularity dashboard
  // while staying well inside platform rate limits.
  cron: "0 */6 * * *",
  run: async () => {
    const refreshed = await analyticsService.refreshAllMetrics();
    console.log(
      `[${new Date().toISOString()}] Refreshed metrics for ${refreshed} posts`,
    );
    return { refreshed };
  },
});
