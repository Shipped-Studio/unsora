import { Request, Response } from "express";
import { prisma } from "../../../lib/db";
import {
  exchangeGoogleBusinessCode,
  getGoogleBusinessAuthUrl,
  getGoogleBusinessLocationPicture,
  getGoogleBusinessLocations,
} from "../../../oauth/google-business";
import { connectRedirect } from "../shared/redirect";
import {
  createConnectState,
  EXPIRED_LINK_MESSAGE,
  readConnectState,
} from "../shared/state";
import { canAddAccount, ACCOUNT_LIMIT_MESSAGE } from "../shared/limits";
import { getUserIdFromClerkId } from "../shared/user";

const PROVIDER = "google_business";

export class GoogleBusinessSchedulerController {
  getGoogleBusinessAuthUrl = async (req: Request, res: Response) => {
    const clerkId = req.auth.userId;
    const userId = await getUserIdFromClerkId(clerkId);

    if (!userId) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const url = getGoogleBusinessAuthUrl(createConnectState(userId, req));
    res.json({ authUrl: url });
  };

  handleGoogleBusinessCallback = async (req: Request, res: Response) => {
    const connect = readConnectState(req.query.state);
    const redirect = connectRedirect(PROVIDER, connect);

    try {
      const { code, state, error } = req.query;

      if (!connect) {
        return res.redirect(redirect("error", EXPIRED_LINK_MESSAGE));
      }

      if (error) {
        console.error("Google Business OAuth error:", { error });
        return res.redirect(
          redirect(
            "error",
            error === "access_denied"
              ? "Authorization was cancelled"
              : (error as string),
          ),
        );
      }

      if (!code || !state) {
        return res.redirect(redirect("error", "No authorization code received"));
      }

      const tokens = await exchangeGoogleBusinessCode(code as string);

      if (
        !String(tokens.scope ?? "").includes(
          "https://www.googleapis.com/auth/business.manage",
        )
      ) {
        return res.redirect(
          redirect(
            "error",
            "Unsora needs permission to manage your Business Profile. Connect again and allow it.",
          ),
        );
      }

      const locations = await getGoogleBusinessLocations(tokens.access_token);
      if (locations.length === 0) {
        return res.redirect(
          redirect(
            "error",
            "No Business Profile locations found on this Google account. You need to be an owner or manager of at least one.",
          ),
        );
      }

      const expiresAt = new Date(
        Date.now() + (tokens.expires_in ?? 3600) * 1000,
      );

      for (const location of locations) {
        // A location can be reachable through more than one Business Profile
        // account; match on the location id so a reconnect that resolves a
        // different account path updates the same row.
        const existing = await prisma.socialAccount.findFirst({
          where: {
            provider: PROVIDER,
            providerAccountId: { endsWith: `/${location.locationName}` },
          },
          select: { id: true, userId: true },
        });

        if (
          !existing &&
          !(await canAddAccount(connect.userId, PROVIDER, location.path))
        ) {
          return res.redirect(redirect("error", ACCOUNT_LIMIT_MESSAGE));
        }

        const profilePicture = await getGoogleBusinessLocationPicture(
          tokens.access_token,
          location.path,
        );

        const data = {
          providerAccountId: location.path,
          accessToken: tokens.access_token,
          ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
          expiresAt,
          scope: tokens.scope || null,
          accountName: location.title,
          accountUsername: location.address,
          ...(profilePicture ? { profilePicture } : {}),
        };

        if (existing) {
          // Another workspace owning this location keeps it; reconnecting
          // from here only refreshes this workspace's own rows.
          if (existing.userId !== connect.userId) continue;
          await prisma.socialAccount.update({
            where: { id: existing.id },
            data,
          });
        } else {
          await prisma.socialAccount.create({
            data: {
              userId: connect.userId,
              provider: PROVIDER,
              ...data,
            },
          });
        }
      }

      res.redirect(redirect("success"));
    } catch (error: any) {
      const apiError = error?.response?.data?.error;
      console.error("Google Business callback error:", apiError || error);

      const message =
        apiError?.status === "PERMISSION_DENIED" ||
        apiError?.code === 403 ||
        error?.response?.status === 429
          ? "Google Business Profile API access isn't enabled for Unsora yet. Please contact support."
          : apiError?.message ||
            (error instanceof Error ? error.message : "Unknown error");
      res.redirect(redirect("error", message));
    }
  };
}
