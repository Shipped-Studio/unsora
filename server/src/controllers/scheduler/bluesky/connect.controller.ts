import { Request, Response } from "express";
import { prisma } from "../../../lib/db";
import {
  getBlueskyAuthUrl,
  getBlueskyClient,
  getBlueskyProfile,
  handleBlueskyCallback,
} from "../../../oauth/bluesky";
import { Agent } from "@atproto/api";
import { schedulerConnectionsRedirect } from "../shared/redirect";
import { getUserIdFromClerkId } from "../shared/user";

export class BlueskySchedulerController {
  /**
   * AT Protocol OAuth starts from the user's handle (it determines which
   * PDS/authorization server to talk to), so the client sends ?handle=…
   */
  getBlueskyAuthUrl = async (req: Request, res: Response) => {
    try {
      const clerkId = req.auth.userId;
      const userId = await getUserIdFromClerkId(clerkId);

      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const handle = String(req.query.handle || "")
        .trim()
        .replace(/^@/, "");
      if (!handle) {
        return res.status(400).json({
          success: false,
          error: "Bluesky handle is required (e.g. alice.bsky.social)",
        });
      }

      const url = await getBlueskyAuthUrl(handle, userId);
      res.json({ authUrl: url });
    } catch (error) {
      console.error("Bluesky auth URL error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to start Bluesky OAuth";
      res.status(500).json({ success: false, error: message });
    }
  };

  handleBlueskyCallback = async (req: Request, res: Response) => {
    try {
      const { error, error_description } = req.query;

      if (error) {
        console.error("Bluesky OAuth error:", { error, error_description });
        return res.redirect(
          schedulerConnectionsRedirect(
            "bluesky",
            "error",
            (error_description as string) ||
              (error as string) ||
              "Authorization failed",
          ),
        );
      }

      const params = new URLSearchParams(
        req.originalUrl.split("?")[1] ?? "",
      );
      const { session, userId } = await handleBlueskyCallback(params);

      const agent = new Agent(session);
      const profile = await getBlueskyProfile(agent);

      await prisma.socialAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: "bluesky",
            providerAccountId: profile.did,
          },
        },
        update: {
          // Tokens are DPoP-bound and live in bluesky_auth_sessions,
          // managed by the OAuth client; this column is just a marker.
          accessToken: "atproto-oauth",
          refreshToken: null,
          expiresAt: null,
          scope: "atproto transition:generic",
          accountName: profile.displayName,
          accountUsername: profile.handle,
          profilePicture: profile.profilePicture,
        },
        create: {
          userId,
          provider: "bluesky",
          providerAccountId: profile.did,
          accessToken: "atproto-oauth",
          scope: "atproto transition:generic",
          accountName: profile.displayName,
          accountUsername: profile.handle,
          profilePicture: profile.profilePicture,
        },
      });

      res.redirect(schedulerConnectionsRedirect("bluesky", "success"));
    } catch (error) {
      console.error("Bluesky callback error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.redirect(
        schedulerConnectionsRedirect("bluesky", "error", errorMessage),
      );
    }
  };

  /**
   * Public client metadata document — its URL is the OAuth client_id.
   * Authorization servers fetch it during every authorization request.
   */
  serveClientMetadata = async (_req: Request, res: Response) => {
    try {
      const client = await getBlueskyClient();
      res.json(client.clientMetadata);
    } catch (error) {
      console.error("Bluesky client metadata error:", error);
      res.status(500).json({ error: "Bluesky OAuth is not configured" });
    }
  };

  /** Public JWKS with the ES256 public key used for private_key_jwt auth. */
  serveJwks = async (_req: Request, res: Response) => {
    try {
      const client = await getBlueskyClient();
      res.json(client.jwks);
    } catch (error) {
      console.error("Bluesky JWKS error:", error);
      res.status(500).json({ error: "Bluesky OAuth is not configured" });
    }
  };
}
