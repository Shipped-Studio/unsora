import { Request, Response } from "express";
import { prisma } from "../../../lib/db";
import {
  exchangeLinkedInCode,
  getLinkedInAuthUrl,
  getLinkedInUser,
} from "../../../oauth/linkedin";
import { connectRedirect } from "../shared/redirect";
import {
  createConnectState,
  EXPIRED_LINK_MESSAGE,
  readConnectState,
} from "../shared/state";
import { canAddAccount, ACCOUNT_LIMIT_MESSAGE } from "../shared/limits";
import { getUserIdFromClerkId } from "../shared/user";

export class LinkedInSchedulerController {
  getLinkedInAuthUrl = async (req: Request, res: Response) => {
    const clerkId = req.auth.userId;
    const userId = await getUserIdFromClerkId(clerkId);

    if (!userId) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const url = getLinkedInAuthUrl(createConnectState(userId, req));
    res.json({ authUrl: url });
  };

  handleLinkedInCallback = async (req: Request, res: Response) => {
    const connect = readConnectState(req.query.state);
    const redirect = connectRedirect("linkedin", connect);

    try {
      const { code, state, error, error_description } = req.query;

      if (!connect) {
        return res.redirect(redirect("error", EXPIRED_LINK_MESSAGE));
      }

      if (error) {
        console.error("LinkedIn OAuth error:", { error, error_description });
        return res.redirect(
          redirect(
            "error",
            (error_description as string) ||
              (error === "user_cancelled_login" ||
              error === "user_cancelled_authorize"
                ? "Authorization was cancelled"
                : (error as string)),
          ),
        );
      }

      if (!code || !state) {
        return res.redirect(
          redirect(
            "error",
            "No authorization code received",
          ),
        );
      }

      const tokens = await exchangeLinkedInCode(code as string);
      const user = await getLinkedInUser(tokens.access_token);

      if (!user) {
        return res.redirect(
          redirect(
            "error",
            "Failed to fetch LinkedIn account info",
          ),
        );
      }

      if (!(await canAddAccount(connect.userId, "linkedin", user.id))) {
        return res.redirect(redirect("error", ACCOUNT_LIMIT_MESSAGE));
      }

      await prisma.socialAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: "linkedin",
            providerAccountId: user.id,
          },
        },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
          expiresAt: new Date(
            Date.now() + (tokens.expires_in ?? 5184000) * 1000,
          ),
          scope: tokens.scope || null,
          accountName: user.name,
          accountUsername: user.email,
          profilePicture: user.profilePicture,
        },
        create: {
          userId: connect.userId,
          provider: "linkedin",
          providerAccountId: user.id,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
          expiresAt: new Date(
            Date.now() + (tokens.expires_in ?? 5184000) * 1000,
          ),
          scope: tokens.scope || null,
          accountName: user.name,
          accountUsername: user.email,
          profilePicture: user.profilePicture,
        },
      });

      res.redirect(redirect("success"));
    } catch (error) {
      console.error("LinkedIn callback error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.redirect(
        redirect("error", errorMessage),
      );
    }
  };
}
