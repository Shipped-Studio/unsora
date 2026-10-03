import { Request, Response } from "express";
import { prisma } from "../../../lib/db";
import {
  exchangeForLongLivedToken,
  exchangeInstagramCode,
  getInstagramAuthUrl,
  getInstagramBusinessAccount,
} from "../../../oauth/instagram";
import { connectRedirect } from "../shared/redirect";
import {
  createConnectState,
  EXPIRED_LINK_MESSAGE,
  readConnectState,
} from "../shared/state";
import { canAddAccount, ACCOUNT_LIMIT_MESSAGE } from "../shared/limits";
import { getUserIdFromClerkId } from "../shared/user";

export class InstagramSchedulerController {
  getInstagramAuthUrl = async (req: Request, res: Response) => {
    const clerkId = req.auth.userId;
    const userId = await getUserIdFromClerkId(clerkId);

    if (!userId) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const url = getInstagramAuthUrl(createConnectState(userId, req));
    res.json({ authUrl: url });
  };

  handleInstagramCallback = async (req: Request, res: Response) => {
    const connect = readConnectState(req.query.state);
    const redirect = connectRedirect("instagram", connect);

    try {
      const { code, state } = req.query;

      if (!connect) {
        return res.redirect(redirect("error", EXPIRED_LINK_MESSAGE));
      }

      const tokens = await exchangeInstagramCode(code as string);
      const longLivedToken = await exchangeForLongLivedToken(
        tokens.access_token as string,
      );

      const accountInfo = await getInstagramBusinessAccount(
        longLivedToken.access_token as string,
      );

      if (!accountInfo) {
        return res.redirect(
          redirect(
            "error",
            "No Instagram Business Account found. Please connect an Instagram Business or Creator account to a Facebook Page.",
          ),
        );
      }

      if (!(await canAddAccount(connect.userId, "instagram", accountInfo.id))) {
        return res.redirect(redirect("error", ACCOUNT_LIMIT_MESSAGE));
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
          userId: connect.userId,
          provider: "instagram",
          providerAccountId: accountInfo.id,
          accessToken: longLivedToken.access_token,
          accountName: accountInfo.username || null,
          accountUsername: accountInfo.username || null,
          profilePicture: accountInfo.profilePicture || null,
          expiresAt: new Date(Date.now() + 5184000 * 1000),
        },
      });

      res.redirect(redirect("success"));
    } catch (error) {
      console.error("Instagram callback error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.redirect(
        redirect("error", errorMessage),
      );
    }
  };
}
