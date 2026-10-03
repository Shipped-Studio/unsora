import { Request, Response } from "express";
import { prisma } from "../../../lib/db";
import {
  exchangeForLongLivedThreadsToken,
  exchangeThreadsCode,
  getThreadsAuthUrl,
  getThreadsProfile,
} from "../../../oauth/threads";
import { connectRedirect } from "../shared/redirect";
import {
  createConnectState,
  EXPIRED_LINK_MESSAGE,
  readConnectState,
} from "../shared/state";
import { canAddAccount, ACCOUNT_LIMIT_MESSAGE } from "../shared/limits";
import { getUserIdFromClerkId } from "../shared/user";

export class ThreadsSchedulerController {
  getThreadsAuthUrl = async (req: Request, res: Response) => {
    const clerkId = req.auth.userId;
    const userId = await getUserIdFromClerkId(clerkId);

    if (!userId) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const url = getThreadsAuthUrl(createConnectState(userId, req));
    res.json({ authUrl: url });
  };

  handleThreadsCallback = async (req: Request, res: Response) => {
    const connect = readConnectState(req.query.state);
    const redirect = connectRedirect("threads", connect);

    try {
      const { code, state, error, error_description } = req.query;

      if (!connect) {
        return res.redirect(redirect("error", EXPIRED_LINK_MESSAGE));
      }

      if (error) {
        console.error("Threads OAuth error:", { error, error_description });
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

      if (!(await canAddAccount(connect.userId, "threads", threadsUserId))) {
        return res.redirect(redirect("error", ACCOUNT_LIMIT_MESSAGE));
      }

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
          userId: connect.userId,
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

      res.redirect(redirect("success"));
    } catch (error) {
      console.error("Threads callback error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.redirect(
        redirect("error", errorMessage),
      );
    }
  };
}
