import { Request, Response } from "express";
import { prisma } from "../../../lib/db";
import {
  exchangeFacebookCode,
  getFacebookAuthUrl,
  getFacebookPagePicture,
  getFacebookPages,
  refreshFacebookToken,
} from "../../../oauth/facebook";
import { connectRedirect } from "../shared/redirect";
import {
  createConnectState,
  EXPIRED_LINK_MESSAGE,
  readConnectState,
} from "../shared/state";
import { canAddAccount, ACCOUNT_LIMIT_MESSAGE } from "../shared/limits";
import { getUserIdFromClerkId } from "../shared/user";

export class FacebookSchedulerController {
  getFacebookAuthUrl = async (req: Request, res: Response) => {
    const clerkId = req.auth.userId;
    const userId = await getUserIdFromClerkId(clerkId);

    if (!userId) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const url = getFacebookAuthUrl(createConnectState(userId, req));
    res.json({ authUrl: url });
  };

  handleFacebookCallback = async (req: Request, res: Response) => {
    const connect = readConnectState(req.query.state);
    const redirect = connectRedirect("facebook", connect);

    try {
      const { code, state, error, error_description } = req.query;

      if (!connect) {
        return res.redirect(redirect("error", EXPIRED_LINK_MESSAGE));
      }

      if (error) {
        console.error("Facebook OAuth error:", { error, error_description });
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

      if (!code || !state) {
        return res.redirect(
          redirect(
            "error",
            "No authorization code received",
          ),
        );
      }

      // Exchange the code, then upgrade the USER token to long-lived once —
      // page tokens fetched with a long-lived user token never expire.
      const tokens = await exchangeFacebookCode(code as string);
      const longLivedUser = await refreshFacebookToken(tokens.access_token);
      const pages = await getFacebookPages(longLivedUser.access_token);

      if (!pages) {
        return res.redirect(
          redirect(
            "error",
            "No Facebook Pages found on this account. You need to be an admin of at least one Page.",
          ),
        );
      }

      for (const page of pages) {
        const profilePicture = await getFacebookPagePicture(
          page.id,
          page.access_token as string,
        );

        if (!(await canAddAccount(connect.userId, "facebook", page.id))) {
          return res.redirect(redirect("error", ACCOUNT_LIMIT_MESSAGE));
        }

        await prisma.socialAccount.upsert({
          where: {
            provider_providerAccountId: {
              provider: "facebook",
              providerAccountId: page.id,
            },
          },
          update: {
            accessToken: page.access_token,
            // Page tokens derived from a long-lived user token don't expire,
            // but keep a 60-day horizon so the refresh path re-validates them.
            expiresAt: new Date(Date.now() + 5184000 * 1000),
            accountName: page.name || null,
            accountUsername: page.username || null,
            profilePicture,
          },
          create: {
            userId: connect.userId,
            provider: "facebook",
            providerAccountId: page.id,
            accessToken: page.access_token,
            expiresAt: new Date(Date.now() + 5184000 * 1000),
            accountName: page.name || null,
            accountUsername: page.username || null,
            profilePicture,
          },
        });
      }

      res.redirect(redirect("success"));
    } catch (error) {
      console.error("Facebook callback error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.redirect(
        redirect("error", errorMessage),
      );
    }
  };
}
