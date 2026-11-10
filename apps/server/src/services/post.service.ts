import { prepareMediaForPlatform } from "../lib/platform-media-fix";
import dotenv from "dotenv";

import { prisma } from "../lib/db";
import { Post, PostAccount, SocialAccount } from "@prisma/client";
import { getPublisher, type PostMediaWithAsset } from "./platforms/publisher";
import { tokenRefreshService } from "./token-refresh.service";
import { onPostPublishFailed } from "../emails";
import {
  PAYMENT_FAILED_MESSAGE,
  hasPaidPlan,
  isPaymentFailing,
  postingAccountLimitForUser,
} from "../lib/plans";
import { logger } from "../lib/logger";

export const PLAN_LIMIT_PUBLISH_ERROR =
  "Your plan doesn't cover this account anymore. Upgrade, or disconnect accounts you don't use.";

/** The accounts a post can't go to right now, and the error each leg records. */
interface PostingBlock {
  accounts: Set<string>;
  reason: string;
}

/**
 * Which of the owner's accounts their queued posts can't go out to.
 *
 * - Payment failing (subscription past due): none of them, until the card is
 *   fixed. The posts fail with that reason and can be retried after.
 * - Otherwise, accounts beyond what the plan covers, oldest connections first.
 *   Connecting already stops at the limit, so this only bites after a
 *   downgrade: queued posts still go out to the accounts the plan covers, not
 *   to every account. Without a live plan (lapsed, or free) the limit is 0, as
 *   posting needs a plan.
 */
async function postingBlock(userId: string): Promise<PostingBlock> {
  const none: PostingBlock = { accounts: new Set(), reason: PLAN_LIMIT_PUBLISH_ERROR };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, isActive: true, status: true },
  });
  if (!user) return none;

  const accounts = await prisma.socialAccount.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (isPaymentFailing(user)) {
    return { accounts: new Set(accounts.map((a) => a.id)), reason: PAYMENT_FAILED_MESSAGE };
  }

  const limit = await postingAccountLimitForUser(user);
  // A paid plan with no limit configured: don't hold paying users back.
  if (limit === null && hasPaidPlan(user)) return none;
  return {
    accounts: new Set(accounts.slice(limit ?? 0).map((a) => a.id)),
    reason: PLAN_LIMIT_PUBLISH_ERROR,
  };
}

/** Failures that come from the account's plan, not from the platform. */
const PLAN_BLOCK_ERRORS = [PLAN_LIMIT_PUBLISH_ERROR, PAYMENT_FAILED_MESSAGE];

/** Quiet time after which a plan failure is emailed about again. */
const PLAN_LAPSE_EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Whether to skip the failure email because it only repeats one the user was
 * just sent. When a plan lapses or a payment is failing, every scheduled post
 * fails for it as it comes due; one email per post would flood them. So the
 * first such failure is emailed, and later ones aren't while another post of
 * theirs failed for the same kind of reason in the last day. Each post still
 * shows the error and can be retried.
 *
 * Posts due at the same moment publish in parallel, so "another post" is one
 * that failed before this run started, or a sibling with a lower id: exactly
 * one of a simultaneous batch sends the email (at worst, a rare second one
 * that checked before its sibling saved).
 */
async function isRepeatPlanLapseFailure(
  userId: string,
  postId: string,
  startedAt: Date,
  failed: PublishResult[],
): Promise<boolean> {
  if (failed.length === 0 || !failed.every((r) => PLAN_BLOCK_ERRORS.includes(r.error ?? ""))) {
    return false;
  }
  const earlier = await prisma.postAccount.count({
    where: {
      error: { in: PLAN_BLOCK_ERRORS },
      updatedAt: { gte: new Date(Date.now() - PLAN_LAPSE_EMAIL_WINDOW_MS) },
      post: { userId, id: { not: postId } },
      OR: [{ updatedAt: { lt: startedAt } }, { postId: { lt: postId } }],
    },
  });
  return earlier > 0;
}

dotenv.config();

export type { PostMediaWithAsset };

// Extended types with relations
type PostWithRelations = Post & {
  media: PostMediaWithAsset[];
  postAccounts: (PostAccount & {
    account: SocialAccount;
  })[];
};

interface PublishResult {
  success: boolean;
  accountId: string;
  platformPostId?: string;
  platformPostUrl?: string;
  error?: string;
}

export class PostService {
  async publishPost(postId: string): Promise<{
    success: boolean;
    results: PublishResult[];
  }> {
    // Before any leg is saved, so this run's own failures count as "later"
    // when deciding whether to email (isRepeatPlanLapseFailure).
    const startedAt = new Date();
    try {
      // Get post with all relations
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
          media: {
            orderBy: { order: "asc" },
            include: { asset: true },
          },
          postAccounts: {
            include: {
              account: true,
            },
          },
        },
      });

      if (!post) {
        throw new Error("Post not found");
      }

      // Legs that already published (e.g. on a retry) are kept as successes
      // and never re-published — retrying must not double-post.
      const alreadyPublished = post.postAccounts.filter((pa) => pa.published);
      const pendingAccounts = post.postAccounts.filter((pa) => !pa.published);

      // Update status to PUBLISHING
      await prisma.post.update({
        where: { id: postId },
        data: { status: "PUBLISHING" },
      });

      const block = await postingBlock(post.userId);

      // Publish to each remaining account
      const results = await Promise.allSettled(
        pendingAccounts.map((postAccount) =>
          this.publishToAccount(post, postAccount, block)
        )
      );

      // Process results
      const publishResults: PublishResult[] = results.map((result, index) => {
        const postAccount = pendingAccounts[index];

        if (result.status === "fulfilled") {
          return result.value;
        } else {
          return {
            success: false,
            accountId: postAccount.accountId,
            error: result.reason?.message || "Unknown error",
          };
        }
      });

      publishResults.push(
        ...alreadyPublished.map((pa) => ({
          success: true,
          accountId: pa.accountId,
          platformPostId: pa.publishedPostId ?? undefined,
          platformPostUrl: pa.publishedUrl ?? undefined,
        }))
      );

      const succeeded = publishResults.filter((r) => r.success);
      const failed = publishResults.filter((r) => !r.success);
      const allSucceeded = failed.length === 0;

      const status = allSucceeded
        ? "PUBLISHED"
        : succeeded.length > 0
          ? "PARTIALLY_PUBLISHED"
          : "FAILED";

      // Update post status
      await prisma.post.update({
        where: { id: postId },
        data: {
          status,
          publishedAt: succeeded.length > 0 ? new Date() : null,
          error: allSucceeded
            ? null
            : `Failed to publish to ${failed.length} of ${publishResults.length} account(s)`,
        },
      });

      if (
        !allSucceeded &&
        !(await isRepeatPlanLapseFailure(post.userId, post.id, startedAt, failed))
      ) {
        const byAccount = new Map(publishResults.map((r) => [r.accountId, r]));
        void onPostPublishFailed({
          userId: post.userId,
          postId: post.id,
          caption: post.mainCaption,
          targets: post.postAccounts.map((pa) => ({
            accountName: pa.account.accountName ?? pa.account.accountUsername,
            provider: pa.account.provider,
            error: byAccount.get(pa.accountId)?.success
              ? null
              : (byAccount.get(pa.accountId)?.error ?? "Unknown error"),
          })),
        });
      }

      return {
        success: allSucceeded,
        results: publishResults,
      };
    } catch (error) {
      // Leave the post in PUBLISHING: the publishing task retries, and its
      // onFailure hook settles the post once attempts run out.
      logger.error("Error publishing post:", error, { postId });
      throw error;
    }
  }

  private async publishToAccount(
    post: PostWithRelations,
    postAccount: PostAccount & { account: SocialAccount },
    block: PostingBlock = { accounts: new Set(), reason: PLAN_LIMIT_PUBLISH_ERROR }
  ): Promise<PublishResult> {
    try {
      // Recorded on the leg like any other publish error, so it can be
      // retried after an upgrade or once the card is fixed.
      if (block.accounts.has(postAccount.accountId)) {
        throw new Error(block.reason);
      }

      let { account } = postAccount;
      const caption = postAccount.customCaption || post.mainCaption;

      // Refresh access token before publishing
      account = await tokenRefreshService.getAccountWithFreshToken(account.id);

      // Fix image format, ratio, carousel consistency and size for this
      // platform (no-op for images that already fit).
      const media = await prepareMediaForPlatform(
        account.provider.toLowerCase(),
        post.type,
        post.media,
      );

      const { postId: platformPostId, postUrl: platformPostUrl } =
        await getPublisher(account.provider).publish({
          postType: post.type,
          media,
          account,
          caption,
          title: postAccount.title,
          settings: postAccount.settings as Record<string, unknown> | null,
        });

      logger.info(`Published to ${account.provider}`, {
        postId: post.id,
        userId: post.userId,
        accountId: account.id,
        provider: account.provider,
        platformPostId: platformPostId ?? "",
        platformPostUrl: platformPostUrl ?? "",
      });

      // Update PostAccount record
      await prisma.postAccount.update({
        where: { id: postAccount.id },
        data: {
          published: true,
          publishedAt: new Date(),
          publishedPostId: platformPostId,
          publishedUrl: platformPostUrl,
          error: null,
        },
      });

      return {
        success: true,
        accountId: account.id,
        platformPostId,
        platformPostUrl,
      };
    } catch (error) {
      logger.error(`Error publishing to ${postAccount.account.provider}:`, error, {
        postId: post.id,
        userId: post.userId,
        accountId: postAccount.accountId,
        provider: postAccount.account.provider,
        postType: post.type,
      });

      // Update PostAccount with error
      await prisma.postAccount.update({
        where: { id: postAccount.id },
        data: {
          published: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });

      return {
        success: false,
        accountId: postAccount.accountId,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const postService = new PostService();
