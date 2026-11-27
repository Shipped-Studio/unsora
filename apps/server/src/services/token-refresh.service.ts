import { Prisma, PrismaClient, SocialAccount } from "@prisma/client";
import { prisma } from "../lib/db";
import { refreshGoogleToken } from "../oauth/google";
import { refreshFacebookToken } from "../oauth/facebook";
import { refreshInstagramToken } from "../oauth/instagram";
import { isFacebookLoginAccount } from "../oauth/instagram-facebook";
import { refreshLinkedInToken } from "../oauth/linkedin";
import { refreshPinterestToken } from "../oauth/pinterest";
import { refreshThreadsToken } from "../oauth/threads";
import { refreshTikTokToken } from "../oauth/tiktok";
import { refreshXToken } from "../oauth/x";
import { logger } from "../lib/logger";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/**
 * How long before expiry a token gets refreshed.
 *
 * Instagram (Instagram Login) and Threads issue 60-day tokens that can only
 * be refreshed while still valid, so a 5-minute window meant they were never
 * refreshed and expired. Pinterest's continuous refresh chain also dies if
 * the account sits idle. These get a 7-day window, which the daily
 * refresh-expiring-tokens task also uses. Short-lived tokens get 15 minutes
 * so a long upload or processing poll doesn't outlive the token.
 */
export function refreshWindowMs(
  account: Pick<SocialAccount, "provider" | "scope">,
): number {
  switch (account.provider.toLowerCase()) {
    case "instagram":
      // Facebook Login connections hold a Page token; keep the old window.
      return isFacebookLoginAccount(account) ? 5 * MINUTE : 7 * DAY;
    case "threads":
    case "pinterest":
      return 7 * DAY;
    case "google":
    case "google_business":
    case "tiktok":
    case "x":
      return 15 * MINUTE;
    default:
      return 5 * MINUTE;
  }
}

/**
 * A token endpoint answering 400/401 (invalid_grant and friends) means the
 * user revoked access or the refresh token died: only reconnecting fixes it.
 * The wording matches the accounts health check's reconnect pattern.
 */
function describeRefreshError(error: unknown): string {
  const status = (error as any)?.response?.status;
  const data = (error as any)?.response?.data;
  if (status === 400 || status === 401) {
    const detail =
      data?.error_description || data?.error?.message || data?.error || "";
    return `access was revoked or expired${
      detail && typeof detail === "string" ? ` (${detail})` : ""
    }. Please reconnect your account.`;
  }
  return error instanceof Error ? error.message : "Unknown error";
}

export class TokenRefreshService {
  /**
   * Refresh access token for a social account and update in database
   * @param account - The social account to refresh token for
   * @param db - Client to write through (the caller's transaction, if any)
   * @returns Updated social account with new access token
   */
  async refreshAndUpdateToken(
    account: SocialAccount,
    db: PrismaClient | Prisma.TransactionClient = prisma
  ): Promise<SocialAccount> {
    // Bluesky tokens are DPoP-bound and managed by @atproto/oauth-client-node
    // (refreshed transparently when the session is restored) — the
    // SocialAccount row only holds a marker, so there is nothing to refresh.
    if (account.provider.toLowerCase() === "bluesky") {
      return account;
    }

    try {
      let newAccessToken: string | null = null;
      let newRefreshToken: string | null = null;
      let newExpiresAt: Date | null = null;

      switch (account.provider.toLowerCase()) {
        case "google": // YouTube
          if (!account.refreshToken) {
            throw new Error("No refresh token available for Google account");
          }

          const googleData = await refreshGoogleToken(account.refreshToken);
          newAccessToken = googleData.access_token;
          // Google returns a new refresh token sometimes
          newRefreshToken = googleData.refresh_token || account.refreshToken;

          // Google tokens typically expire in 1 hour
          if (googleData.expires_in) {
            newExpiresAt = new Date(Date.now() + googleData.expires_in * 1000);
          }
          break;

        case "facebook":
          // Facebook uses long-lived tokens (60 days)
          // Exchange current token for a new long-lived token
          const facebookData = await refreshFacebookToken(account.accessToken);
          newAccessToken = facebookData.access_token;

          // Facebook tokens typically expire in 60 days
          if (facebookData.expires_in) {
            newExpiresAt = new Date(
              Date.now() + facebookData.expires_in * 1000
            );
          }
          break;

        case "instagram":
          try {
            // Facebook Login connections hold a Page token; refresh it like Facebook's.
            const instagramData = isFacebookLoginAccount(account)
              ? await refreshFacebookToken(account.accessToken)
              : await refreshInstagramToken(account.accessToken);
            newAccessToken = instagramData?.access_token ?? null;

            // Instagram long-lived tokens expire in 60 days
            if (instagramData?.expires_in) {
              newExpiresAt = new Date(
                Date.now() + instagramData.expires_in * 1000
              );
            }
          } catch (refreshError) {
            // Instagram refuses to refresh long-lived tokens younger than
            // 24 hours. If the stored token hasn't actually expired, keep
            // using it instead of failing the whole publish.
            const stillValid =
              account.expiresAt &&
              new Date(account.expiresAt).getTime() > Date.now();
            if (stillValid) {
              logger.warn(
                "Instagram token refresh failed but stored token is still valid; using it.",
                refreshError instanceof Error
                  ? refreshError.message
                  : refreshError
              );
              return account;
            }
            throw refreshError;
          }
          break;

        case "threads":
          try {
            const threadsData = await refreshThreadsToken(account.accessToken);
            newAccessToken = threadsData?.access_token ?? null;

            if (threadsData?.expires_in) {
              newExpiresAt = new Date(
                Date.now() + threadsData.expires_in * 1000
              );
            }
          } catch (refreshError) {
            // Threads refuses to refresh tokens younger than 24 hours.
            // If the stored token hasn't actually expired, keep using it.
            const stillValid =
              account.expiresAt &&
              new Date(account.expiresAt).getTime() > Date.now();
            if (stillValid) {
              logger.warn(
                "Threads token refresh failed but stored token is still valid; using it.",
                refreshError instanceof Error
                  ? refreshError.message
                  : refreshError
              );
              return account;
            }
            throw refreshError;
          }
          break;

        case "pinterest":
          if (!account.refreshToken) {
            throw new Error("No refresh token available for Pinterest account");
          }

          const pinterestData = await refreshPinterestToken(
            account.refreshToken
          );
          newAccessToken = pinterestData.access_token || null;
          // Continuous refresh rotates the refresh token — keep the new one.
          newRefreshToken =
            pinterestData.refresh_token || account.refreshToken;

          if (pinterestData.expires_in) {
            newExpiresAt = new Date(
              Date.now() + pinterestData.expires_in * 1000
            );
          }
          break;

        case "linkedin":
          // LinkedIn only issues refresh tokens to approved partner apps.
          // Without one, keep using the 60-day token until it expires, then
          // the member has to reconnect.
          if (!account.refreshToken) {
            const stillValid =
              account.expiresAt &&
              new Date(account.expiresAt).getTime() > Date.now();
            if (stillValid) {
              return account;
            }
            throw new Error(
              "LinkedIn access token expired. Please reconnect your account."
            );
          }

          const linkedinData = await refreshLinkedInToken(
            account.refreshToken
          );
          newAccessToken = linkedinData.access_token || null;
          newRefreshToken = linkedinData.refresh_token || account.refreshToken;

          if (linkedinData.expires_in) {
            newExpiresAt = new Date(
              Date.now() + linkedinData.expires_in * 1000
            );
          }
          break;

        case "tiktok":
          if (!account.refreshToken) {
            throw new Error("No refresh token available for TikTok account");
          }

          const tiktokData = await refreshTikTokToken(account.refreshToken);
          newAccessToken = tiktokData.access_token || null;
          newRefreshToken = tiktokData.refresh_token || account.refreshToken;

          // TikTok tokens typically expire based on expires_in
          if (tiktokData.expires_in) {
            newExpiresAt = new Date(Date.now() + tiktokData.expires_in * 1000);
          }
          break;

        case "x":
          if (!account.refreshToken) {
            throw new Error("No refresh token available for X account");
          }

          const xData = await refreshXToken(account.refreshToken);
          newAccessToken = xData.access_token || null;
          // X rotates the refresh token on every refresh — keep the new one.
          newRefreshToken = xData.refresh_token || account.refreshToken;

          if (xData.expires_in) {
            newExpiresAt = new Date(Date.now() + xData.expires_in * 1000);
          }
          break;

        case "google_business":
          // Same Google OAuth client as YouTube, so the same refresh call.
          if (!account.refreshToken) {
            throw new Error(
              "No refresh token available for Google Business account"
            );
          }

          const googleBusinessData = await refreshGoogleToken(
            account.refreshToken
          );
          newAccessToken = googleBusinessData.access_token;
          newRefreshToken =
            googleBusinessData.refresh_token || account.refreshToken;

          if (googleBusinessData.expires_in) {
            newExpiresAt = new Date(
              Date.now() + googleBusinessData.expires_in * 1000
            );
          }
          break;

        default:
          throw new Error(`Unsupported platform: ${account.provider}`);
      }

      if (!newAccessToken) {
        throw new Error(
          `Failed to refresh token for ${account.provider} account`
        );
      }

      // Update the account in database with new token
      const updatedAccount = await db.socialAccount.update({
        where: { id: account.id },
        data: {
          accessToken: newAccessToken,
          ...(newRefreshToken && { refreshToken: newRefreshToken }),
          ...(newExpiresAt && { expiresAt: newExpiresAt }),
          updatedAt: new Date(),
        },
      });

      return updatedAccount;
    } catch (error) {
      logger.error(
        `Error refreshing token for ${account.provider} account:`,
        error
      );
      throw new Error(
        `Token refresh failed for ${account.provider}: ${describeRefreshError(
          error
        )}`
      );
    }
  }

  /**
   * Check if token needs refresh (inside its refreshWindowMs or already expired)
   * @param account - The social account to check
   * @returns true if token should be refreshed
   */
  shouldRefreshToken(account: SocialAccount): boolean {
    // If no expiry date, always refresh to be safe
    if (!account.expiresAt) {
      return true;
    }

    const expiryTime = new Date(account.expiresAt).getTime();
    return expiryTime - Date.now() <= refreshWindowMs(account);
  }

  /**
   * Get fresh account with valid token
   * Refreshes token if needed before returning
   * @param accountId - The account ID to get
   * @returns Account with valid access token
   */
  async getAccountWithFreshToken(accountId: string): Promise<SocialAccount> {
    const account = await prisma.socialAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    if (!this.shouldRefreshToken(account)) {
      return account;
    }

    // Concurrent publishes for one account would otherwise refresh in
    // parallel, and providers that rotate refresh tokens (TikTok, Pinterest)
    // invalidate all but one of them. Serialize per account and re-check
    // after the lock: the run that waited usually finds a fresh token.
    return prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${accountId}))`;

        const current = await tx.socialAccount.findUnique({
          where: { id: accountId },
        });
        if (!current) {
          throw new Error(`Account not found: ${accountId}`);
        }
        if (!this.shouldRefreshToken(current)) {
          return current;
        }

        return this.refreshAndUpdateToken(current, tx);
      },
      { maxWait: 30_000, timeout: 30_000 }
    );
  }
}

export const tokenRefreshService = new TokenRefreshService();
