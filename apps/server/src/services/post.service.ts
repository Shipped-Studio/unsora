import { prepareMediaForPlatform } from "../lib/platform-media-fix";
import dotenv from "dotenv";

import { prisma } from "../lib/db";
import { Post, PostAccount, SocialAccount, PostMedia, Asset } from "@prisma/client";
import { blueskyService } from "./platforms/bluesky.service";
import { facebookService } from "./platforms/facebook.service";
import { instagramService } from "./platforms/instagram.service";
import { linkedInService } from "./platforms/linkedin.service";
import { pinterestService } from "./platforms/pinterest.service";
import { threadsService } from "./platforms/threads.service";
import { tiktokService } from "./platforms/tiktok.service";
import { youtubeService } from "./platforms/youtube.service";
import { xService } from "./platforms/x.service";
import { googleBusinessService } from "./platforms/google-business.service";
import { tokenRefreshService } from "./token-refresh.service";
import { onPostPublishFailed } from "../emails";

dotenv.config();

export type PostMediaWithAsset = PostMedia & { asset: Asset };

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

      // Publish to each remaining account
      const results = await Promise.allSettled(
        pendingAccounts.map((postAccount) =>
          this.publishToAccount(post, postAccount)
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

      if (!allSucceeded) {
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
      console.error("Error publishing post:", error);
      throw error;
    }
  }

  private async publishToAccount(
    post: PostWithRelations,
    postAccount: PostAccount & { account: SocialAccount }
  ): Promise<PublishResult> {
    try {
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

      let platformPostId: string | undefined;
      let platformPostUrl: string | undefined;

      // Route to appropriate platform
      switch (account.provider.toLowerCase()) {
        case "google": // YouTube
          const youtubeResult = await youtubeService.publishPost(
            post.type,
            media,
            account,
            caption,
            postAccount.title || caption.substring(0, 100),
            postAccount.settings as Record<string, unknown> | null,
          );
          platformPostId = youtubeResult.postId;
          platformPostUrl = youtubeResult.postUrl;
          break;

        case "facebook":
          const facebookResult = await facebookService.publishPost(
            post.type,
            media,
            account,
            caption
          );
          platformPostId = facebookResult.postId;
          platformPostUrl = facebookResult.postUrl;
          break;

        case "instagram":
          const instagramResult = await instagramService.publishPost(
            post.type,
            media,
            account,
            caption,
          );
          platformPostId = instagramResult.postId;
          platformPostUrl = instagramResult.postUrl;
          break;

        case "bluesky":
          const blueskyResult = await blueskyService.publishPost(
            post.type,
            media,
            account,
            caption,
          );
          platformPostId = blueskyResult.postId;
          platformPostUrl = blueskyResult.postUrl;
          break;

        case "threads":
          const threadsResult = await threadsService.publishPost(
            post.type,
            media,
            account,
            caption,
          );
          platformPostId = threadsResult.postId;
          platformPostUrl = threadsResult.postUrl;
          break;

        case "pinterest":
          const pinterestResult = await pinterestService.publishPost(
            post.type,
            media,
            account,
            caption,
            postAccount.settings as Record<string, unknown> | null,
          );
          platformPostId = pinterestResult.postId;
          platformPostUrl = pinterestResult.postUrl;
          break;

        case "linkedin":
          const linkedInResult = await linkedInService.publishPost(
            post.type,
            media,
            account,
            caption,
          );
          platformPostId = linkedInResult.postId;
          platformPostUrl = linkedInResult.postUrl;
          break;

        case "tiktok":
          const tiktokResult = await tiktokService.publishPost(
            post.type,
            media,
            account,
            caption,
            postAccount.settings as Record<string, unknown> | null,
          );
          platformPostId = tiktokResult.postId;
          platformPostUrl = tiktokResult.postUrl;
          break;

        case "x":
          const xResult = await xService.publishPost(
            post.type,
            media,
            account,
            caption,
          );
          platformPostId = xResult.postId;
          platformPostUrl = xResult.postUrl;
          break;

        case "google_business":
          const googleBusinessResult = await googleBusinessService.publishPost(
            post.type,
            media,
            account,
            caption,
            postAccount.settings as Record<string, unknown> | null,
          );
          platformPostId = googleBusinessResult.postId;
          platformPostUrl = googleBusinessResult.postUrl;
          break;

        default:
          throw new Error(`Unsupported platform: ${account.provider}`);
      }

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
      console.error(
        `Error publishing to ${postAccount.account.provider}:`,
        error
      );

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
