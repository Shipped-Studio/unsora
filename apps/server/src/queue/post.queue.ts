import {
  task,
  schedules,
  idempotencyKeys,
  BatchTriggerError,
} from "@trigger.dev/sdk";
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
  // Platform publishes poll media processing in-process, so each run holds its
  // slot for the whole publish. Capped by the environment concurrency limit.
  queue: { concurrencyLimit: 100 },
  retry: STANDARD_RETRY,
  run: async (payload: PostPublishingJobData): Promise<PostPublishingResult> => {
    const { postId } = payload;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { status: true, publishedAt: true },
    });

    // Deleted while queued: nothing to publish.
    if (!post) {
      return { success: false, postId, error: "Post not found" };
    }

    if (post.status === "PUBLISHED") {
      return {
        success: true,
        postId,
        publishedAt: post.publishedAt || undefined,
        results: [],
      };
    }

    // Someone else settled the post while this run waited (sweeper, the user
    // unscheduling or editing it). Leave their state alone.
    if (post.status !== "SCHEDULED" && post.status !== "PUBLISHING") {
      return {
        success: false,
        postId,
        error: `Skipped: post is ${post.status}`,
      };
    }

    // Per-account errors are settled inside publishPost; anything it throws is
    // infrastructure (DB, network) and is left to the retry policy. Legs that
    // already published are skipped on the retry, and onFailure settles the
    // post once attempts run out.
    const result = await postService.publishPost(postId);

    return {
      success: result.success,
      postId,
      publishedAt: result.success ? new Date() : undefined,
      results: result.results,
    };
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

// Shared terminal handler for onFailure/onCancel. Settles a post that is still
// in flight from its legs: any published leg makes it PARTIALLY_PUBLISHED so
// the user can retry just the rest.
async function finalizePost(payload: PostPublishingJobData, message: string) {
  const { postId } = payload;

  try {
    const legs = await prisma.postAccount.findMany({
      where: { postId },
      select: { published: true },
    });
    const published = legs.filter((leg) => leg.published).length;
    const status =
      legs.length > 0 && published === legs.length
        ? "PUBLISHED"
        : published > 0
          ? "PARTIALLY_PUBLISHED"
          : "FAILED";

    await prisma.post.updateMany({
      where: { id: postId, status: { in: ["SCHEDULED", "PUBLISHING"] } },
      data: {
        status,
        error: status === "PUBLISHED" ? null : message,
        ...(published > 0 ? { publishedAt: new Date() } : {}),
      },
    });
  } catch (updateError) {
    console.error(
      `[Post ${postId}] Failed to update post status:`,
      updateError
    );
  }
}

// Helper function to add a post publishing job. Callers pass a `jobId` unique
// to the attempt; it becomes a globally scoped idempotency key, so a repeated
// request for the same attempt reuses the existing run.
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
    idempotencyKey: await idempotencyKeys.create(
      options?.jobId ?? jobData.postId,
      { scope: "global" },
    ),
    idempotencyKeyTTL: "10m",
  });
  return { id: handle.id };
};

// Max posts claimed and enqueued per batchTrigger call (the API's ceiling).
const CLAIM_BATCH_SIZE = 1000;
// Stop claiming new batches after this long so one tick never runs into the
// next. Overlap is safe anyway (claims use SKIP LOCKED), just wasteful.
const TICK_BUDGET_MS = 45_000;

interface ClaimedPost {
  id: string;
  userId: string;
  scheduledFor: Date;
}

/**
 * Atomically flip up to `limit` due posts SCHEDULED → PUBLISHING and return
 * them. SKIP LOCKED lets overlapping ticks claim disjoint sets, and claiming
 * before triggering means a fast run can never be overwritten by the flip.
 */
async function claimDuePosts(limit: number): Promise<ClaimedPost[]> {
  const now = new Date();
  // Prisma stores DateTime as UTC in `timestamp` (no zone) columns; converting
  // the parameter to UTC wall time keeps this independent of the session
  // TimeZone and lets the (status, scheduledFor) index serve the filter.
  return prisma.$queryRaw<ClaimedPost[]>`
    UPDATE "posts"
    SET "status" = 'PUBLISHING'::"PostStatus",
        "updatedAt" = (${now}::timestamptz AT TIME ZONE 'UTC')
    WHERE "id" IN (
      SELECT "id" FROM "posts"
      WHERE "status" = 'SCHEDULED'::"PostStatus"
        AND "scheduledFor" <= (${now}::timestamptz AT TIME ZONE 'UTC')
      ORDER BY "scheduledFor" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "userId", "scheduledFor"
  `;
}

/** Hand claimed posts back to the scheduler after a failed enqueue. */
async function releasePosts(ids: string[]) {
  await prisma.post.updateMany({
    where: { id: { in: ids }, status: "PUBLISHING" },
    data: { status: "SCHEDULED" },
  });
}

async function enqueueClaimed(posts: ClaimedPost[]) {
  const items = await Promise.all(
    posts.map(async (post) => ({
      payload: { postId: post.id, userId: post.userId },
      options: {
        // Keyed by the scheduled slot: if a batch call succeeds but its
        // response is lost, the release + re-claim reuses the same runs.
        idempotencyKey: await idempotencyKeys.create(
          `scheduled:${post.id}:${post.scheduledFor.getTime()}`,
          { scope: "global" },
        ),
        idempotencyKeyTTL: "1h",
      },
    })),
  );
  await postPublishingTask.batchTrigger(items);
}

// Function to queue scheduled posts that are due. Claims in batches and
// enqueues each batch with a single batchTrigger call.
export const queueScheduledPosts = async (): Promise<number> => {
  const startedAt = Date.now();
  let queuedCount = 0;

  while (Date.now() - startedAt < TICK_BUDGET_MS) {
    const claimed = await claimDuePosts(CLAIM_BATCH_SIZE);
    if (claimed.length === 0) break;

    try {
      await enqueueClaimed(claimed);
      queuedCount += claimed.length;
    } catch (error) {
      await releasePosts(claimed.map((post) => post.id));
      if (error instanceof BatchTriggerError && error.isRateLimited) {
        console.warn(
          `[Scheduler] Batch trigger rate limited; ${claimed.length} posts released for the next tick`,
        );
      } else {
        console.error(`[Scheduler] Failed to enqueue ${claimed.length} posts:`, error);
      }
      break;
    }

    if (claimed.length < CLAIM_BATCH_SIZE) break;
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
