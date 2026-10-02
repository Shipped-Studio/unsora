import { Request, Response } from "express";
import { prisma } from "../../../lib/db";
import {
  exchangeGoogleCode,
  getGoogleAuthUrl,
  getGoogleUser,
  getYouTubeChannelInfo,
} from "../../../oauth/google";
import { schedulerConnectionsRedirect } from "../shared/redirect";
import { getUserIdFromClerkId } from "../shared/user";

export class GoogleSchedulerController {
  getGoogleAuthUrl = async (req: Request, res: Response) => {
    const clerkId = req.auth.userId;
    const userId = await getUserIdFromClerkId(clerkId);

    if (!userId) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const url = getGoogleAuthUrl(userId);
    res.json({ authUrl: url });
  };

  handleGoogleCallback = async (req: Request, res: Response) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        console.error("Google OAuth error:", error);
        return res.redirect(
          schedulerConnectionsRedirect(
            "youtube",
            "error",
            error === "access_denied"
              ? "Authorization was cancelled"
              : (error as string),
          ),
        );
      }

      if (!code || !state) {
        return res.redirect(
          schedulerConnectionsRedirect(
            "youtube",
            "error",
            "No authorization code received",
          ),
        );
      }

      const tokens = await exchangeGoogleCode(code as string);

      const requiredScopes = [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly",
      ];

      const grantedScopes = (tokens.scope as string)?.split(" ") || [];
      const missingScopes = requiredScopes.filter(
        (scope) => !grantedScopes.includes(scope),
      );

      if (missingScopes.length > 0) {
        console.error("Missing required scopes:", missingScopes);
        return res.redirect(
          schedulerConnectionsRedirect(
            "youtube",
            "error",
            "Required permissions were not granted. Please allow all permissions to upload videos to YouTube.",
          ),
        );
      }

      const userInfo = await getGoogleUser(tokens.access_token as string);
      const channelInfo = await getYouTubeChannelInfo(
        tokens.access_token as string,
      );

      if (!channelInfo) {
        return res.redirect(
          schedulerConnectionsRedirect(
            "youtube",
            "error",
            "No YouTube channel found. Please create a YouTube channel first.",
          ),
        );
      }

      await prisma.socialAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: userInfo.sub as string,
          },
        },
        update: {
          accessToken: tokens.access_token as string,
          refreshToken: tokens.refresh_token as string,
          // Google's token response reports lifetime as expires_in (seconds).
          expiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
          scope: tokens.scope,
          accountName: channelInfo.name || null,
          accountUsername: channelInfo.username || null,
          profilePicture: channelInfo.profilePicture || null,
        },
        create: {
          userId: state as string,
          provider: "google",
          providerAccountId: userInfo.sub as string,
          accessToken: tokens.access_token as string,
          refreshToken: tokens.refresh_token as string,
          expiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
          scope: tokens.scope,
          accountName: channelInfo.name || null,
          accountUsername: channelInfo.username || null,
          profilePicture: channelInfo.profilePicture || null,
        },
      });

      res.redirect(schedulerConnectionsRedirect("youtube", "success"));
    } catch (error) {
      console.error("Google callback error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.redirect(schedulerConnectionsRedirect("youtube", "error", errorMessage));
    }
  };
}
