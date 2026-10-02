import { Request, Response } from "express";
import { prisma } from "../../../lib/db";
import {
  exchangeForLongLivedToken,
  exchangeInstagramCode,
  getInstagramAuthUrl,
  getInstagramBusinessAccount,
} from "../../../oauth/instagram";
import { schedulerConnectionsRedirect } from "../shared/redirect";
import { getUserIdFromClerkId } from "../shared/user";

export class InstagramSchedulerController {
  getInstagramAuthUrl = async (req: Request, res: Response) => {
    const clerkId = req.auth.userId;
    const userId = await getUserIdFromClerkId(clerkId);

    if (!userId) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const url = getInstagramAuthUrl(userId);
    res.json({ authUrl: url });
  };

  handleInstagramCallback = async (req: Request, res: Response) => {
    try {
      const { code, state } = req.query;

      const tokens = await exchangeInstagramCode(code as string);
      const longLivedToken = await exchangeForLongLivedToken(
        tokens.access_token as string,
      );

      const accountInfo = await getInstagramBusinessAccount(
        longLivedToken.access_token as string,
      );

      if (!accountInfo) {
        return res.redirect(
          schedulerConnectionsRedirect(
            "instagram",
            "error",
            "No Instagram Business Account found. Please connect an Instagram Business or Creator account to a Facebook Page.",
          ),
        );
      }

      await prisma.socialAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: "instagram",
            providerAccountId: accountInfo.id,
          },
        },
        update: {
          accessToken: longLivedToken.access_token,
          accountName: accountInfo.username || null,
          accountUsername: accountInfo.username || null,
          profilePicture: accountInfo.profilePicture || null,
          expiresAt: new Date(Date.now() + 5184000 * 1000),
        },
        create: {
          userId: state as string,
          provider: "instagram",
          providerAccountId: accountInfo.id,
          accessToken: longLivedToken.access_token,
          accountName: accountInfo.username || null,
          accountUsername: accountInfo.username || null,
          profilePicture: accountInfo.profilePicture || null,
          expiresAt: new Date(Date.now() + 5184000 * 1000),
        },
      });

      res.redirect(schedulerConnectionsRedirect("instagram", "success"));
    } catch (error) {
      console.error("Instagram callback error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.redirect(
        schedulerConnectionsRedirect("instagram", "error", errorMessage),
      );
    }
  };
}
