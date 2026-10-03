import { Prisma, PrismaClient, SocialAccount } from "@prisma/client";
import { prisma } from "../lib/db";
import { refreshGoogleToken } from "../oauth/google";
import { refreshFacebookToken } from "../oauth/facebook";
import { refreshInstagramToken } from "../oauth/instagram";
import { refreshLinkedInToken } from "../oauth/linkedin";
import { refreshPinterestToken } from "../oauth/pinterest";
import { refreshThreadsToken } from "../oauth/threads";
import { refreshTikTokToken } from "../oauth/tiktok";
import { refreshXToken } from "../oauth/x";

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
            const instagramData = await refreshInstagramToken(
              account.accessToken
            );
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
              console.warn(
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
              console.warn(
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
      console.error(
        `Error refreshing token for ${account.provider} account:`,
        error
      );
      throw new Error(
        `Token refresh failed for ${account.provider}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Check if token needs refresh (within 5 minutes of expiry or already expired)
   * @param account - The social account to check
   * @returns true if token should be refreshed
   */
  shouldRefreshToken(account: SocialAccount): boolean {
    // If no expiry date, always refresh to be safe
    if (!account.expiresAt) {
      return true;
    }

    // Refresh if token expires within 5 minutes (300000ms)
    const buffer = 5 * 60 * 1000;
    const expiryTime = new Date(account.expiresAt).getTime();
    const now = Date.now();

    return expiryTime - now <= buffer;
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
