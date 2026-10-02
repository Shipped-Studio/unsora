import { task, schedules } from "@trigger.dev/sdk";
import prisma from "../lib/db";
import { STANDARD_RETRY, CANCELLED_ERROR } from "./task-utils";
import { postService } from "../services/post.service";

// Job data interface for post publishing
export interface PostPublishingJobData {
  postId: string;
  userId: string;
}

// Job result interface for post publishing
export interface PostPublishingResult {
  success: boolean;
  postId: string;
  publishedAt?: Date;
  error?: string;
  results?: {
    accountId: string;
    success: boolean;
    platformPostId?: string;
    platformPostUrl?: string;
    error?: string;
  }[];
}

export const postPublishingTask = task({
  id: "post-publishing",
  queue: { concurrencyLimit: 10 },
  retry: STANDARD_RETRY,
  run: async (
    payload: PostPublishingJobData,
    { ctx },
  ): Promise<PostPublishingResult> => {
    const { postId } = payload;

    try {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
          postAccounts: {
            include: {
              account: true,
            },
          },
        },
      });

      if (!post) {
        throw new Error(`Post not found: ${postId}`);
      }

      // Check if post is already published or in wrong state
      if (post.status === "PUBLISHED") {
        return {
          success: true,
          postId,
          publishedAt: post.publishedAt || undefined,
          results: [],
        };
      }

      if (post.status !== "SCHEDULED" && post.status !== "PUBLISHING") {
        throw new Error(
          `Post ${postId} is in invalid state: ${post.status}. Expected SCHEDULED or PUBLISHING.`
        );
      }

      const result = await postService.publishPost(postId);

      return {
        success: result.success,
        postId,
        publishedAt: result.success ? new Date() : undefined,
        results: result.results,
      };
    } catch (error) {
      console.error(`[Post ${ctx.run.id}] Post publishing error:`, error);

      // Try to update post status to FAILED
      try {
        await prisma.post.update({
          where: { id: postId },
          data: {
            status: "FAILED",
            error:
              error instanceof Error ? error.message : "Publishing failed",
          },
        });
      } catch (updateError) {
        console.error(
          `[Post ${ctx.run.id}] Failed to update post status:`,
          updateError
        );
      }

      throw error; // Re-throw to mark run as failed and trigger retry
    }
  },
  // Runs only after all retries are exhausted.
  onFailure: async ({ payload, error }) => {
    const message = error instanceof Error ? error.message : String(error);
    await finalizePost(payload, `Publishing failed after all attempts: ${message}`);
  },
  // Cancelled runs skip onFailure. Without this, a cancelled publish leaves the
  // post stuck in PUBLISHING forever (the scheduler only re-selects SCHEDULED).
  onCancel: async ({ payload }) => {
    await finalizePost(payload, CANCELLED_ERROR);
  },
});

// Shared terminal handler for onFailure/onCancel: mark the post FAILED so the
// UI stops polling and the user can retry or reschedule it.
async function finalizePost(payload: PostPublishingJobData, message: string) {
  const { postId } = payload;

  try {
    await prisma.post.update({
      where: { id: postId },
      data: {
        status: "FAILED",
        error: message,
      },
    });
  } catch (updateError) {
    console.error(
      `[Post ${postId}] Failed to update post status:`,
      updateError
    );
  }
}

// Helper function to add a post publishing job. `idempotencyKey` (the postId)
// guards against the per-minute scheduler enqueueing the same post twice.
export const addPostPublishingJob = async (
  jobData: PostPublishingJobData,
  options?: {
    priority?: number;
    delay?: number;
    jobId?: string;
  }
) => {
  const handle = await postPublishingTask.trigger(jobData, {
    delay: options?.delay ? new Date(Date.now() + options.delay) : undefined,
    idempotencyKey: options?.jobId ?? jobData.postId,
    idempotencyKeyTTL: "10m",
  });
  return { id: handle.id };
};

// Function to queue scheduled posts that are due. Replaces the BullMQ
// `isPostInQueue` dedup with a DB status flip (SCHEDULED → PUBLISHING) so the
// next scheduler tick won't re-select the same post.
export const queueScheduledPosts = async (): Promise<number> => {
  const now = new Date();

  const scheduledPosts = await prisma.post.findMany({
    where: {
      status: "SCHEDULED",
      scheduledFor: {
        lte: now,
      },
    },
    select: {
      id: true,
      userId: true,
      scheduledFor: true,
    },
  });

  if (scheduledPosts.length === 0) {
    return 0;
  }

  let queuedCount = 0;

  for (const post of scheduledPosts) {
    try {
      await addPostPublishingJob(
        {
          postId: post.id,
          userId: post.userId,
        },
        { jobId: post.id }
      );

      // Flip status so subsequent scheduler ticks skip this post. The worker
      // accepts both SCHEDULED and PUBLISHING states.
      await prisma.post.update({
        where: { id: post.id },
        data: { status: "PUBLISHING" },
      });

      queuedCount++;
    } catch (error) {
      console.error(`Error queuing scheduled post ${post.id}:`, error);
    }
  }

  return queuedCount;
};

// Scheduled task: runs every minute to enqueue due posts. Replaces the old
// standalone node-cron process (src/cron.ts).
export const scheduledPostsCron = schedules.task({
  id: "scheduled-posts",
  cron: "* * * * *",
  run: async () => {
    const queuedCount = await queueScheduledPosts();
    if (queuedCount > 0) {
      console.log(
        `[${new Date().toISOString()}] Queued ${queuedCount} posts for publishing`
      );
    }
    return { queuedCount };
  },
});
