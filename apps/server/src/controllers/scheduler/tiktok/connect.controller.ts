import { Request, Response } from "express";
import { prisma } from "../../../lib/db";
import {
  exchangeTikTokCode,
  getTikTokAuthUrl,
  getTikTokCreatorInfo,
  getTikTokUserInfo,
} from "../../../oauth/tiktok";
import { connectRedirect } from "../shared/redirect";
import {
  createConnectState,
  EXPIRED_LINK_MESSAGE,
  readConnectState,
} from "../shared/state";
import { canAddAccount, ACCOUNT_LIMIT_MESSAGE } from "../shared/limits";
import { getUserIdFromClerkId } from "../shared/user";

export class TikTokSchedulerController {
  getTikTokAuthUrl = async (req: Request, res: Response) => {
    const clerkId = req.auth.userId;
    const userId = await getUserIdFromClerkId(clerkId);

    if (!userId) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const url = getTikTokAuthUrl(createConnectState(userId, req));
    res.json({ authUrl: url });
  };

  handleTikTokCallback = async (req: Request, res: Response) => {
    const connect = readConnectState(req.query.state);
    const redirect = connectRedirect("tiktok", connect);

    try {
      const { code, state, error, error_description } = req.query;

      if (!connect) {
        return res.redirect(redirect("error", EXPIRED_LINK_MESSAGE));
      }

      if (error) {
        console.error("TikTok OAuth error:", { error, error_description });
        return res.redirect(
          redirect(
            "error",
            (error_description as string) ||
              (error as string) ||
              "Authorization failed",
          ),
        );
      }

      if (!code) {
        return res.redirect(
          redirect(
            "error",
            "No authorization code received",
          ),
        );
      }

      const tokens = await exchangeTikTokCode(code as string);
      const userInfo = await getTikTokUserInfo(tokens.access_token);

      if (!(await canAddAccount(connect.userId, "tiktok", tokens.open_id))) {
        return res.redirect(redirect("error", ACCOUNT_LIMIT_MESSAGE));
      }

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
          userId: connect.userId,
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

      res.redirect(redirect("success"));
    } catch (error) {
      console.error("TikTok callback error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.redirect(redirect("error", errorMessage));
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
