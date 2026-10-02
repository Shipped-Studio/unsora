import { Request, Response } from "express";
import { prisma } from "../../../lib/db";
import {
  exchangeFacebookCode,
  getFacebookAuthUrl,
  getFacebookPagePicture,
  getFacebookPages,
  refreshFacebookToken,
} from "../../../oauth/facebook";
import { schedulerConnectionsRedirect } from "../shared/redirect";
import { getUserIdFromClerkId } from "../shared/user";

export class FacebookSchedulerController {
  getFacebookAuthUrl = async (req: Request, res: Response) => {
    const clerkId = req.auth.userId;
    const userId = await getUserIdFromClerkId(clerkId);

    if (!userId) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const url = getFacebookAuthUrl(userId);
    res.json({ authUrl: url });
  };

  handleFacebookCallback = async (req: Request, res: Response) => {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        console.error("Facebook OAuth error:", { error, error_description });
        return res.redirect(
          schedulerConnectionsRedirect(
            "facebook",
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
          schedulerConnectionsRedirect(
            "facebook",
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
          schedulerConnectionsRedirect(
            "facebook",
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
            userId: state as string,
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

      res.redirect(schedulerConnectionsRedirect("facebook", "success"));
    } catch (error) {
      console.error("Facebook callback error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.redirect(
        schedulerConnectionsRedirect("facebook", "error", errorMessage),
      );
    }
  };
}
