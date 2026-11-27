import { schedules } from "@trigger.dev/sdk";
import { prisma } from "../lib/db";
import { logger } from "../lib/logger";
import { tokenRefreshService } from "../services/token-refresh.service";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Refresh tokens that would otherwise expire on accounts that aren't posting.
 * Publishing refreshes tokens on demand, but Instagram and Threads 60-day
 * tokens can only be refreshed while still valid, and Pinterest's refresh
 * chain lapses if unused, so an idle account would need a reconnect. This
 * picks up every such token inside its 7-day refresh window.
 *
 * getAccountWithFreshToken takes the per-account lock and re-checks the
 * window, so it's safe alongside publishes and skips anything not due
 * (including Instagram accounts connected through Facebook Login).
 */
export const refreshExpiringTokens = schedules.task({
  id: "refresh-expiring-tokens",
  cron: "0 3 * * *",
  queue: { concurrencyLimit: 1 },
  run: async () => {
    const now = Date.now();
    const accounts = await prisma.socialAccount.findMany({
      where: {
        expiresAt: { lte: new Date(now + 7 * DAY) },
        OR: [
          // Expired Instagram/Threads tokens can't be refreshed; skip them.
          { provider: { in: ["instagram", "threads"] }, expiresAt: { gt: new Date(now) } },
          // Pinterest's refresh token outlives the access token.
          { provider: "pinterest", refreshToken: { not: null } },
        ],
      },
      select: { id: true, provider: true },
    });

    let refreshed = 0;
    const failed: { id: string; provider: string; error: string }[] = [];
    for (const account of accounts) {
      try {
        await tokenRefreshService.getAccountWithFreshToken(account.id);
        refreshed++;
      } catch (error) {
        failed.push({
          id: account.id,
          provider: account.provider,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (failed.length) {
      logger.warn("refresh-expiring-tokens: some refreshes failed", { failed });
    }
    return { checked: accounts.length, refreshed, failed: failed.length };
  },
});
