import { BatchTriggerError, schedules, task, wait } from "@trigger.dev/sdk";
import { analyticsService } from "../services/analytics.service";

// batchTrigger accepts at most 1,000 items per call.
const FAN_OUT_BATCH_SIZE = 1000;

/**
 * Poll one social account's recent posts. One run per account keeps each run
 * small, isolates a slow or revoked account, and lets the fan-out scale with
 * the number of accounts instead of growing one run without bound.
 */
export const accountMetricsRefreshTask = task({
  id: "account-metrics-refresh",
  // Platform rate limits are per app as well as per account; keep the fan-out
  // from hammering them all at once.
  queue: { concurrencyLimit: 20 },
  retry: { maxAttempts: 2 },
  run: async (payload: { accountId: string }) => {
    const refreshed = await analyticsService.refreshAccountMetrics(
      payload.accountId,
    );
    return { refreshed };
  },
});

/**
 * Scheduled task: poll engagement metrics for recently published posts.
 * Platforms don't push metric counts over webhooks, so polling is the only
 * way to keep analytics current.
 */
export const postMetricsCron = schedules.task({
  id: "post-metrics-refresh",
  // Every 6 hours — frequent enough for a daily-granularity dashboard
  // while staying well inside platform rate limits.
  cron: "0 */6 * * *",
  run: async () => {
    const accountIds = await analyticsService.listAccountsToRefresh();

    for (let i = 0; i < accountIds.length; ) {
      try {
        await accountMetricsRefreshTask.batchTrigger(
          accountIds
            .slice(i, i + FAN_OUT_BATCH_SIZE)
            .map((accountId) => ({ payload: { accountId } })),
        );
        i += FAN_OUT_BATCH_SIZE;
      } catch (error) {
        if (!(error instanceof BatchTriggerError && error.isRateLimited)) {
          throw error;
        }
        // Past the batch token bucket: wait for it to refill, then resend.
        await wait.for({
          seconds: Math.max(10, Math.ceil((error.retryAfterMs ?? 0) / 1000)),
        });
      }
    }

    console.log(
      `[${new Date().toISOString()}] Queued metrics refresh for ${accountIds.length} accounts`,
    );
    return { accounts: accountIds.length };
  },
});
