import { Request, Response } from "express";
import { prisma } from "../../../lib/db";
import {
  getFacebookPagePicture,
  refreshFacebookToken,
} from "../../../oauth/facebook";
import { refreshGoogleToken, getYouTubeChannelInfo } from "../../../oauth/google";
import {
  getInstagramAccountInfo,
  refreshInstagramToken,
} from "../../../oauth/instagram";
import { getTikTokUserInfo, refreshTikTokToken } from "../../../oauth/tiktok";
import {
  getBlueskyAgent,
  getBlueskyProfile,
  revokeBlueskySession,
} from "../../../oauth/bluesky";
import { getThreadsProfile, refreshThreadsToken } from "../../../oauth/threads";
import {
  getLinkedInUser,
  refreshLinkedInToken,
} from "../../../oauth/linkedin";
import {
  getPinterestUser,
  refreshPinterestToken,
} from "../../../oauth/pinterest";
import { getUserIdFromClerkId } from "../shared/user";

export class SchedulerAccountsController {
  getConnectedAccounts = async (req: Request, res: Response) => {
    try {
      const clerkId = req.auth.userId;
      const userId = await getUserIdFromClerkId(clerkId);

      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const accounts = await prisma.socialAccount.findMany({
        where: { userId },
        select: {
          id: true,
          provider: true,
          providerAccountId: true,
          accountName: true,
          accountUsername: true,
          profilePicture: true,
          expiresAt: true,
        },
      });

      res.json({ success: true, data: accounts });
    } catch (error) {
      console.error("Get connected accounts error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch connected accounts",
      });
    }
  };

  refreshAccount = async (req: Request, res: Response) => {
    try {
      const { accountId } = req.params;
      const clerkId = req.auth.userId;
      const userId = await getUserIdFromClerkId(clerkId);

      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const account = await prisma.socialAccount.findFirst({
        where: {
          id: accountId,
          userId,
        },
      });

      if (!account) {
        return res.status(404).json({
          success: false,
          error: "Account not found",
        });
      }

      let updatedData: any = {};

      switch (account.provider) {
        case "google": {
          if (!account.refreshToken) {
            return res.status(400).json({
              success: false,
              error: "No refresh token available for this account",
            });
          }

          const tokens = await refreshGoogleToken(account.refreshToken);
          const channelInfo = await getYouTubeChannelInfo(
            tokens.access_token as string,
          );

          updatedData = {
            accessToken: tokens.access_token,
            expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
            accountName: channelInfo?.name || account.accountName,
            accountUsername: channelInfo?.username || account.accountUsername,
            profilePicture: channelInfo?.profilePicture || account.profilePicture,
          };
          break;
        }

        case "tiktok": {
          if (!account.refreshToken) {
            return res.status(400).json({
              success: false,
              error: "No refresh token available for this account",
            });
          }

          const tokens = await refreshTikTokToken(account.refreshToken);
          const userInfo = await getTikTokUserInfo(tokens.access_token);

          updatedData = {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token || account.refreshToken,
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            accountName: userInfo?.displayName || account.accountName,
            accountUsername: userInfo?.username || account.accountUsername,
            profilePicture: userInfo?.profilePicture || account.profilePicture,
          };
          break;
        }

        case "facebook": {
          if (!account.accessToken) {
            return res.status(400).json({
              success: false,
              error: "No access token available for this account",
            });
          }

          const longLivedToken = await refreshFacebookToken(account.accessToken);

          let profilePicture = account.profilePicture;
          if (account.providerAccountId) {
            profilePicture = await getFacebookPagePicture(
              account.providerAccountId,
              longLivedToken.access_token,
            );
          }

          updatedData = {
            accessToken: longLivedToken.access_token,
            expiresAt: new Date(
              Date.now() + (longLivedToken.expires_in || 5184000) * 1000,
            ),
            profilePicture: profilePicture || account.profilePicture,
          };
          break;
        }

        case "instagram": {
          if (!account.accessToken) {
            return res.status(400).json({
              success: false,
              error: "No access token available for this account",
            });
          }

          const longLivedToken = await refreshInstagramToken(account.accessToken);

          let accountInfo: {
            username: string | null;
            profilePicture: string | null;
          } | null = null;
          if (account.providerAccountId) {
            accountInfo = await getInstagramAccountInfo(longLivedToken.access_token);
          }

          updatedData = {
            accessToken: longLivedToken.access_token,
            expiresAt: new Date(Date.now() + 5184000 * 1000),
            accountUsername: accountInfo?.username || account.accountUsername,
            accountName: accountInfo?.username || account.accountName,
            profilePicture: accountInfo?.profilePicture || account.profilePicture,
          };
          break;
        }

        case "bluesky": {
          // OAuth session refresh is handled transparently by the atproto
          // client on restore; just re-validate and update profile info.
          const agent = await getBlueskyAgent(account.providerAccountId);
          const profile = await getBlueskyProfile(agent);

          updatedData = {
            accountName: profile.displayName || account.accountName,
            accountUsername: profile.handle || account.accountUsername,
            profilePicture: profile.profilePicture || account.profilePicture,
          };
          break;
        }

        case "threads": {
          const tokens = await refreshThreadsToken(account.accessToken);
          const profile = await getThreadsProfile(tokens.access_token);

          updatedData = {
            accessToken: tokens.access_token,
            expiresAt: new Date(
              Date.now() + (tokens.expires_in || 5184000) * 1000,
            ),
            accountName: profile?.name || account.accountName,
            accountUsername: profile?.username || account.accountUsername,
            profilePicture: profile?.profilePicture || account.profilePicture,
          };
          break;
        }

        case "pinterest": {
          if (!account.refreshToken) {
            return res.status(400).json({
              success: false,
              error: "No refresh token available for this account",
            });
          }

          const tokens = await refreshPinterestToken(account.refreshToken);
          const user = await getPinterestUser(tokens.access_token);

          updatedData = {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token || account.refreshToken,
            expiresAt: new Date(
              Date.now() + (tokens.expires_in || 2592000) * 1000,
            ),
            accountName: user?.username || account.accountName,
            accountUsername: user?.username || account.accountUsername,
            profilePicture: user?.profilePicture || account.profilePicture,
          };
          break;
        }

        case "linkedin": {
          // Refresh tokens are partner-only on LinkedIn; without one the
          // stored 60-day token is reused and only profile info is updated.
          let accessToken = account.accessToken;
          if (account.refreshToken) {
            const tokens = await refreshLinkedInToken(account.refreshToken);
            accessToken = tokens.access_token;
            updatedData = {
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token || account.refreshToken,
              expiresAt: new Date(
                Date.now() + (tokens.expires_in || 5184000) * 1000,
              ),
            };
          }

          const user = await getLinkedInUser(accessToken);
          updatedData = {
            ...updatedData,
            accountName: user?.name || account.accountName,
            accountUsername: user?.email || account.accountUsername,
            profilePicture: user?.profilePicture || account.profilePicture,
          };
          break;
        }

        default:
          return res.status(400).json({
            success: false,
            error: `Refresh not supported for provider: ${account.provider}`,
          });
      }

      const updatedAccount = await prisma.socialAccount.update({
        where: { id: accountId },
        data: updatedData,
        select: {
          id: true,
          provider: true,
          providerAccountId: true,
          accountName: true,
          accountUsername: true,
          profilePicture: true,
          expiresAt: true,
        },
      });

      res.json({
        success: true,
        message: "Account refreshed successfully",
        data: updatedAccount,
      });
    } catch (error) {
      console.error("Refresh account error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        success: false,
        error: `Failed to refresh account: ${errorMessage}`,
      });
    }
  };

  disconnectAccount = async (req: Request, res: Response) => {
    try {
      const { accountId } = req.params;
      const clerkId = req.auth.userId;
      const userId = await getUserIdFromClerkId(clerkId);

      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const account = await prisma.socialAccount.findFirst({
        where: {
          id: accountId,
          userId,
        },
      });

      if (!account) {
        return res.status(404).json({
          success: false,
          error: "Account not found",
        });
      }

      await prisma.socialAccount.delete({
        where: { id: accountId },
      });

      if (account.provider === "bluesky") {
        // Also revoke/remove the stored AT Protocol OAuth session.
        await revokeBlueskySession(account.providerAccountId);
      }

      res.json({ success: true, message: "Account disconnected" });
    } catch (error) {
      console.error("Disconnect account error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to disconnect account",
      });
    }
  };
}
