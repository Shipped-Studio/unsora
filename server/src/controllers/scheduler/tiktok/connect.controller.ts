import { Request, Response } from "express";
import { prisma } from "../../../lib/db";
import {
  exchangeTikTokCode,
  getTikTokAuthUrl,
  getTikTokCreatorInfo,
  getTikTokUserInfo,
} from "../../../oauth/tiktok";
import { schedulerConnectionsRedirect } from "../shared/redirect";
import { getUserIdFromClerkId } from "../shared/user";

export class TikTokSchedulerController {
  getTikTokAuthUrl = async (req: Request, res: Response) => {
    const clerkId = req.auth.userId;
    const userId = await getUserIdFromClerkId(clerkId);

    if (!userId) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const url = getTikTokAuthUrl(userId);
    res.json({ authUrl: url });
  };

  handleTikTokCallback = async (req: Request, res: Response) => {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        console.error("TikTok OAuth error:", { error, error_description });
        return res.redirect(
          schedulerConnectionsRedirect(
            "tiktok",
            "error",
            (error_description as string) ||
              (error as string) ||
              "Authorization failed",
          ),
        );
      }

      if (!code) {
        return res.redirect(
          schedulerConnectionsRedirect(
            "tiktok",
            "error",
            "No authorization code received",
          ),
        );
      }

      const tokens = await exchangeTikTokCode(code as string);
      const userInfo = await getTikTokUserInfo(tokens.access_token);

      await prisma.socialAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: "tiktok",
            providerAccountId: tokens.open_id,
          },
        },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          scope: tokens.scope,
          accountName: userInfo?.displayName || null,
          accountUsername: userInfo?.username || null,
          profilePicture: userInfo?.profilePicture || null,
        },
        create: {
          userId: state as string,
          provider: "tiktok",
          providerAccountId: tokens.open_id,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          scope: tokens.scope,
          accountName: userInfo?.displayName || null,
          accountUsername: userInfo?.username || null,
          profilePicture: userInfo?.profilePicture || null,
        },
      });

      res.redirect(schedulerConnectionsRedirect("tiktok", "success"));
    } catch (error) {
      console.error("TikTok callback error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.redirect(schedulerConnectionsRedirect("tiktok", "error", errorMessage));
    }
  };

  getTikTokCreatorInfo = async (req: Request, res: Response) => {
    try {
      const clerkId = req.auth.userId;
      const { accountId } = req.params;
      const userId = await getUserIdFromClerkId(clerkId);

      if (!userId) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const account = await prisma.socialAccount.findFirst({
        where: {
          id: accountId,
          userId,
          provider: "tiktok",
        },
      });

      if (!account) {
        return res.status(404).json({
          success: false,
          error: "TikTok account not found",
        });
      }

      const creatorInfo = await getTikTokCreatorInfo(account.accessToken as string);

      if (!creatorInfo) {
        return res.status(500).json({
          success: false,
          error: "Failed to fetch creator info from TikTok",
        });
      }

      res.json({
        success: true,
        data: creatorInfo,
      });
    } catch (error) {
      console.error("Get TikTok creator info error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch TikTok creator info",
      });
    }
  };
}
