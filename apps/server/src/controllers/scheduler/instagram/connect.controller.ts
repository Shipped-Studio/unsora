import { Request, Response } from "express";
import { prisma } from "../../../lib/db";
import {
  exchangeForLongLivedToken,
  exchangeInstagramCode,
  getInstagramAuthUrl,
  getInstagramBusinessAccount,
} from "../../../oauth/instagram";
import {
  exchangeForLongLivedFacebookUserToken,
  exchangeInstagramFacebookCode,
  FACEBOOK_LOGIN_SCOPE,
  describeFacebookGrant,
  getInstagramFacebookAuthUrl,
  getLinkedInstagramAccounts,
  instagramFacebookConfigured,
} from "../../../oauth/instagram-facebook";
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
          scope: null,
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

  // ─── Connect via Facebook Login ───

  getInstagramFacebookAuthUrl = async (req: Request, res: Response) => {
    if (!instagramFacebookConfigured()) {
      return res.status(503).json({
        success: false,
        error: "Connecting Instagram with Facebook isn't set up on this server.",
      });
    }

    const clerkId = req.auth.userId;
    const userId = await getUserIdFromClerkId(clerkId);

    if (!userId) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const url = getInstagramFacebookAuthUrl(createConnectState(userId, req));
    res.json({ authUrl: url });
  };

  handleInstagramFacebookCallback = async (req: Request, res: Response) => {
    const connect = readConnectState(req.query.state);
    const redirect = connectRedirect("instagram", connect);

    try {
      const { code, error, error_description } = req.query;

      if (!connect) {
        return res.redirect(redirect("error", EXPIRED_LINK_MESSAGE));
      }

      if (error) {
        console.error("Instagram (Facebook Login) OAuth error:", {
          error,
          error_description,
        });
        return res.redirect(
          redirect(
            "error",
            (error_description as string) ||
              (error === "access_denied"
                ? "Authorization was cancelled"
                : (error as string)),
          ),
        );
      }

      if (!code) {
        return res.redirect(redirect("error", "No authorization code received"));
      }

      // Long-lived user token first: Page tokens derived from it don't expire.
      const tokens = await exchangeInstagramFacebookCode(code as string);
      const longLivedUser = await exchangeForLongLivedFacebookUserToken(
        tokens.access_token,
      );

      const accounts = await getLinkedInstagramAccounts(
        longLivedUser.access_token,
      );

      if (accounts.length === 0) {
        console.warn(
          "Instagram (Facebook Login): no linked Instagram account found.",
          JSON.stringify(await describeFacebookGrant(longLivedUser.access_token)),
        );
        return res.redirect(
          redirect(
            "error",
            "No Instagram professional account found. Link an Instagram Business or Creator account to a Facebook Page you manage, then try again.",
          ),
        );
      }

      for (const account of accounts) {
        if (!(await canAddAccount(connect.userId, "instagram", account.id))) {
          return res.redirect(redirect("error", ACCOUNT_LIMIT_MESSAGE));
        }

        const data = {
          accessToken: account.pageAccessToken,
          accountName: account.username || account.name || null,
          accountUsername: account.username || null,
          profilePicture: account.profilePicture || null,
          scope: FACEBOOK_LOGIN_SCOPE,
          // Same 60-day horizon as the Facebook connector, so the refresh
          // path re-validates the token.
          expiresAt: new Date(Date.now() + 5184000 * 1000),
        };

        await prisma.socialAccount.upsert({
          where: {
            provider_providerAccountId: {
              provider: "instagram",
              providerAccountId: account.id,
            },
          },
          update: data,
          create: {
            userId: connect.userId,
            provider: "instagram",
            providerAccountId: account.id,
            ...data,
          },
        });
      }

      res.redirect(redirect("success"));
    } catch (error: any) {
      console.error(
        "Instagram (Facebook Login) callback error:",
        error?.response?.data || error,
      );
      const errorMessage =
        error?.response?.data?.error?.message ||
        (error instanceof Error ? error.message : "Unknown error");
      res.redirect(redirect("error", errorMessage));
    }
  };
}
