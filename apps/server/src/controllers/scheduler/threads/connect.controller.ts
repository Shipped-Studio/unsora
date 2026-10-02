import { Request, Response } from "express";
import { prisma } from "../../../lib/db";
import {
  exchangeForLongLivedThreadsToken,
  exchangeThreadsCode,
  getThreadsAuthUrl,
  getThreadsProfile,
} from "../../../oauth/threads";
import { schedulerConnectionsRedirect } from "../shared/redirect";
import { getUserIdFromClerkId } from "../shared/user";

export class ThreadsSchedulerController {
  getThreadsAuthUrl = async (req: Request, res: Response) => {
    const clerkId = req.auth.userId;
    const userId = await getUserIdFromClerkId(clerkId);

    if (!userId) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const url = getThreadsAuthUrl(userId);
    res.json({ authUrl: url });
  };

  handleThreadsCallback = async (req: Request, res: Response) => {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        console.error("Threads OAuth error:", { error, error_description });
        return res.redirect(
          schedulerConnectionsRedirect(
            "threads",
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
            "threads",
            "error",
            "No authorization code received",
          ),
        );
      }

      const shortLived = await exchangeThreadsCode(code as string);
      const longLived = await exchangeForLongLivedThreadsToken(
        shortLived.access_token,
      );

      const accessToken = longLived.access_token as string;
      const expiresAt = new Date(
        Date.now() + (longLived.expires_in ?? 5184000) * 1000,
      );

      const profile = await getThreadsProfile(accessToken);
      const threadsUserId = profile?.id || String(shortLived.user_id);

      await prisma.socialAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: "threads",
            providerAccountId: threadsUserId,
          },
        },
        update: {
          accessToken,
          expiresAt,
          scope: "threads_basic,threads_content_publish,threads_manage_insights",
          accountName: profile?.name || null,
          accountUsername: profile?.username || null,
          profilePicture: profile?.profilePicture || null,
        },
        create: {
          userId: state as string,
          provider: "threads",
          providerAccountId: threadsUserId,
          accessToken,
          expiresAt,
          scope: "threads_basic,threads_content_publish,threads_manage_insights",
          accountName: profile?.name || null,
          accountUsername: profile?.username || null,
          profilePicture: profile?.profilePicture || null,
        },
      });

      res.redirect(schedulerConnectionsRedirect("threads", "success"));
    } catch (error) {
      console.error("Threads callback error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.redirect(
        schedulerConnectionsRedirect("threads", "error", errorMessage),
      );
    }
  };
}
