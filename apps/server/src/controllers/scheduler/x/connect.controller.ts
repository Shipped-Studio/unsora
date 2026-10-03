import { Request, Response } from "express";
import { prisma } from "../../../lib/db";
import { exchangeXCode, getXAuthUrl, getXUser } from "../../../oauth/x";
import { connectRedirect } from "../shared/redirect";
import {
  createConnectState,
  EXPIRED_LINK_MESSAGE,
  pkceVerifierForState,
  readConnectState,
} from "../shared/state";
import { canAddAccount, ACCOUNT_LIMIT_MESSAGE } from "../shared/limits";
import { getUserIdFromClerkId } from "../shared/user";

/** X access tokens last 2 hours. */
const X_DEFAULT_EXPIRES_IN = 7200;

export class XSchedulerController {
  getXAuthUrl = async (req: Request, res: Response) => {
    const clerkId = req.auth.userId;
    const userId = await getUserIdFromClerkId(clerkId);

    if (!userId) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const state = createConnectState(userId, req);
    const url = getXAuthUrl(state, pkceVerifierForState(state));
    res.json({ authUrl: url });
  };

  handleXCallback = async (req: Request, res: Response) => {
    const connect = readConnectState(req.query.state);
    const redirect = connectRedirect("x", connect);

    try {
      const { code, state, error, error_description } = req.query;

      if (!connect) {
        return res.redirect(redirect("error", EXPIRED_LINK_MESSAGE));
      }

      if (error) {
        console.error("X OAuth error:", { error, error_description });
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
        return res.redirect(redirect("error", "No authorization code received"));
      }

      const tokens = await exchangeXCode(
        code as string,
        pkceVerifierForState(state as string),
      );
      const user = await getXUser(tokens.access_token);

      if (!user) {
        return res.redirect(redirect("error", "Failed to fetch X account info"));
      }

      if (!(await canAddAccount(connect.userId, "x", user.id))) {
        return res.redirect(redirect("error", ACCOUNT_LIMIT_MESSAGE));
      }

      const data = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiresAt: new Date(
          Date.now() + (tokens.expires_in ?? X_DEFAULT_EXPIRES_IN) * 1000,
        ),
        scope: tokens.scope || null,
        accountName: user.name,
        accountUsername: user.username,
        profilePicture: user.profilePicture,
      };

      await prisma.socialAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: "x",
            providerAccountId: user.id,
          },
        },
        update: data,
        create: {
          userId: connect.userId,
          provider: "x",
          providerAccountId: user.id,
          ...data,
        },
      });

      res.redirect(redirect("success"));
    } catch (error: any) {
      console.error("X callback error:", error?.response?.data || error);
      const errorMessage =
        error?.response?.data?.error_description ||
        (error instanceof Error ? error.message : "Unknown error");
      res.redirect(redirect("error", errorMessage));
    }
  };
}
