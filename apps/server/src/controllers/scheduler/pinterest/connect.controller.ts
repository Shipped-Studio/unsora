import { Request, Response } from "express";
import { prisma } from "../../../lib/db";
import {
  exchangePinterestCode,
  getPinterestAuthUrl,
  getPinterestBoards,
  getPinterestUser,
} from "../../../oauth/pinterest";
import { tokenRefreshService } from "../../../services/token-refresh.service";
import { schedulerConnectionsRedirect } from "../shared/redirect";
import { getUserIdFromClerkId } from "../shared/user";

export class PinterestSchedulerController {
  getPinterestAuthUrl = async (req: Request, res: Response) => {
    const clerkId = req.auth.userId;
    const userId = await getUserIdFromClerkId(clerkId);

    if (!userId) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const url = getPinterestAuthUrl(userId);
    res.json({ authUrl: url });
  };

  handlePinterestCallback = async (req: Request, res: Response) => {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        console.error("Pinterest OAuth error:", { error, error_description });
        return res.redirect(
          schedulerConnectionsRedirect(
            "pinterest",
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
            "pinterest",
            "error",
            "No authorization code received",
          ),
        );
      }

      const tokens = await exchangePinterestCode(code as string);
      const user = await getPinterestUser(tokens.access_token);

      if (!user) {
        return res.redirect(
          schedulerConnectionsRedirect(
            "pinterest",
            "error",
            "Failed to fetch Pinterest account info",
          ),
        );
      }

      await prisma.socialAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: "pinterest",
            providerAccountId: user.id,
          },
        },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
          expiresAt: new Date(
            Date.now() + (tokens.expires_in ?? 2592000) * 1000,
          ),
          scope: tokens.scope || null,
          accountName: user.username,
          accountUsername: user.username,
          profilePicture: user.profilePicture,
        },
        create: {
          userId: state as string,
          provider: "pinterest",
          providerAccountId: user.id,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
          expiresAt: new Date(
            Date.now() + (tokens.expires_in ?? 2592000) * 1000,
          ),
          scope: tokens.scope || null,
          accountName: user.username,
          accountUsername: user.username,
          profilePicture: user.profilePicture,
        },
      });

      res.redirect(schedulerConnectionsRedirect("pinterest", "success"));
    } catch (error) {
      console.error("Pinterest callback error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.redirect(
        schedulerConnectionsRedirect("pinterest", "error", errorMessage),
      );
    }
  };

  /** List the account's boards — used by the compose UI to pick a target. */
  getPinterestBoards = async (req: Request, res: Response) => {
    try {
      const clerkId = req.auth.userId;
      const { accountId } = req.params;
      const userId = await getUserIdFromClerkId(clerkId);

      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const account = await prisma.socialAccount.findFirst({
        where: { id: accountId, userId, provider: "pinterest" },
      });

      if (!account) {
        return res.status(404).json({
          success: false,
          error: "Pinterest account not found",
        });
      }

      const fresh = await tokenRefreshService.getAccountWithFreshToken(
        account.id,
      );
      const boards = await getPinterestBoards(fresh.accessToken);

      res.json({ success: true, data: boards });
    } catch (error) {
      console.error("Get Pinterest boards error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch Pinterest boards",
      });
    }
  };
}
