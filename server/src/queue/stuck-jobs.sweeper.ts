import { schedules } from "@trigger.dev/sdk";
import { CreditTransactionType } from "@prisma/client";
import prisma from "../lib/db";
import { refundConsumption } from "../lib/credits";

/**
 * Safety net for jobs whose runs died without any lifecycle hook firing:
 * runs cancelled while still QUEUED (onCancel only fires once a run is
 * executing), worker crashes, deleted deployments, or terminal hooks that
 * themselves errored. Any row still in a non-terminal status long past any
 * plausible runtime is marked failed and its credit consumption refunded.
 *
 * Safe to re-run: the status flip uses a guarded updateMany (won't touch rows
 * that completed in the meantime) and refundConsumption is idempotent (no-ops
 * if the transaction was already refunded by onFailure/onCancel).
 */

const STALE_ERROR =
  "Timed out: job was stuck in a non-terminal state (auto-failed by sweeper)";

// A started run flips its row to PROCESSING within seconds and media jobs
// finish in minutes; 2h without the row moving means the run is gone.
const PROCESSING_STALE_MS = 2 * 60 * 60 * 1000;
// QUEUED rows can legitimately sit behind a concurrency backlog — be lenient.
const QUEUED_STALE_MS = 6 * 60 * 60 * 1000;

/**
 * Find the CONSUMPTION transaction that charged for this row (call sites store
 * the row id in the transaction metadata under feature-specific keys) and
 * refund it. Returns true if a matching transaction was found.
 */
async function refundForRow(
  rowId: string,
  metadataKeys: string[],
  reason: string,
): Promise<boolean> {
  for (const key of metadataKeys) {
    const txn = await prisma.creditTransaction.findFirst({
      where: {
        type: CreditTransactionType.CONSUMPTION,
        metadata: { path: [key], equals: rowId },
      },
      select: { id: true },
    });

    if (txn) {
      await refundConsumption(txn.id, reason, { [key]: rowId });
      return true;
    }
  }
  return false;
}

/**
 * Minimal structural view of a Prisma model delegate. The concrete delegates
 * have stricter generic signatures, so the table below casts through unknown;
 * every model listed has `id`, `status`, `error` and `updatedAt` fields.
 */
interface SweepableDelegate {
  findMany(args: {
    where: unknown;
    select: { id: true };
  }): Promise<{ id: string }[]>;
  updateMany(args: {
    where: unknown;
    data: unknown;
  }): Promise<{ count: number }>;
}

interface SweepTarget {
  /** Model name, for logging. */
  name: string;
  delegate: SweepableDelegate;
  /** Non-terminal status values, in the model's own casing. */
  queuedStatus: string;
  processingStatus: string;
  failedStatus: string;
  /** Metadata keys under which call sites stored this row's id at charge time. */
  refundKeys: string[];
  refundReason: string;
}

const asDelegate = (d: unknown) => d as SweepableDelegate;

const SWEEP_TARGETS: SweepTarget[] = [
  {
    name: "imageGeneration",
    delegate: asDelegate(prisma.imageGeneration),
    queuedStatus: "QUEUED",
    processingStatus: "PROCESSING",
    failedStatus: "FAILED",
    // image-generation/influencer/movie-materials/thumbnail charge under
    // generationId; image-upscale charges under jobId.
    refundKeys: ["generationId", "jobId"],
    refundReason: "sweeper.image_generation.stuck",
  },
  {
    name: "generation",
    delegate: asDelegate(prisma.generation),
    queuedStatus: "QUEUED",
    processingStatus: "PROCESSING",
    failedStatus: "FAILED",
    refundKeys: ["generationId"],
    refundReason: "sweeper.video_generation.stuck",
  },
  {
    name: "musicGeneration",
    delegate: asDelegate(prisma.musicGeneration),
    queuedStatus: "QUEUED",
    processingStatus: "PROCESSING",
    failedStatus: "FAILED",
    refundKeys: ["generationId"],
    refundReason: "sweeper.music_generation.stuck",
  },
  {
    name: "voiceGeneration",
    delegate: asDelegate(prisma.voiceGeneration),
    queuedStatus: "QUEUED",
    processingStatus: "PROCESSING",
    failedStatus: "FAILED",
    refundKeys: ["generationId"],
    refundReason: "sweeper.voice_generation.stuck",
  },
  {
    name: "avatarGeneration",
    delegate: asDelegate(prisma.avatarGeneration),
    queuedStatus: "QUEUED",
    processingStatus: "PROCESSING",
    failedStatus: "FAILED",
    refundKeys: ["generationId"],
    refundReason: "sweeper.avatar_generation.stuck",
  },
  {
    name: "voiceConversion",
    delegate: asDelegate(prisma.voiceConversion),
    queuedStatus: "QUEUED",
    processingStatus: "PROCESSING",
    failedStatus: "FAILED",
    refundKeys: ["conversionId"],
    refundReason: "sweeper.voice_conversion.stuck",
  },
  {
    name: "aIClipping",
    delegate: asDelegate(prisma.aIClipping),
    queuedStatus: "QUEUED",
    processingStatus: "PROCESSING",
    failedStatus: "FAILED",
    refundKeys: ["clippingId"],
    refundReason: "sweeper.ai_clipping.stuck",
  },
  {
    name: "processedVideo",
    delegate: asDelegate(prisma.processedVideo),
    queuedStatus: "queued",
    processingStatus: "processing",
    failedStatus: "failed",
    refundKeys: ["processedVideoId"],
    refundReason: "sweeper.video_processing.stuck",
  },
  {
    name: "transcription",
    delegate: asDelegate(prisma.transcription),
    queuedStatus: "queued",
    processingStatus: "processing",
    failedStatus: "failed",
    refundKeys: [], // transcription itself is not charged
    refundReason: "sweeper.transcription.stuck",
  },
];

async function sweepTarget(target: SweepTarget): Promise<{
  swept: number;
  refunded: number;
}> {
  const now = Date.now();

  const stuck = await target.delegate.findMany({
    where: {
      OR: [
        {
          status: target.processingStatus,
          updatedAt: { lt: new Date(now - PROCESSING_STALE_MS) },
        },
        {
          status: target.queuedStatus,
          updatedAt: { lt: new Date(now - QUEUED_STALE_MS) },
        },
      ],
    },
    select: { id: true },
  });

  let swept = 0;
  let refunded = 0;

  for (const row of stuck) {
    // Guarded flip: skip rows that reached a terminal state since findMany.
    const res = await target.delegate.updateMany({
      where: {
        id: row.id,
        status: { in: [target.queuedStatus, target.processingStatus] },
      },
      data: { status: target.failedStatus, error: STALE_ERROR },
    });
    if (res.count === 0) continue;
    swept += 1;

    try {
      if (await refundForRow(row.id, target.refundKeys, target.refundReason)) {
        refunded += 1;
      }
    } catch (refundError) {
      console.error(
        `[Sweeper] Failed to refund ${target.name} ${row.id}:`,
        refundError,
      );
    }
  }

  return { swept, refunded };
}

/**
 * VideoExport has no updatedAt column, so staleness is judged from createdAt
 * with the lenient threshold for both queued and processing rows.
 */
async function sweepVideoExports(): Promise<{ swept: number; refunded: number }> {
  const cutoff = new Date(Date.now() - QUEUED_STALE_MS);

  const stuck = await prisma.videoExport.findMany({
    where: {
      status: { in: ["queued", "processing"] },
      createdAt: { lt: cutoff },
    },
    select: { id: true },
  });

  let swept = 0;
  let refunded = 0;

  for (const row of stuck) {
    const res = await prisma.videoExport.updateMany({
      where: { id: row.id, status: { in: ["queued", "processing"] } },
      data: { status: "failed", error: STALE_ERROR },
    });
    if (res.count === 0) continue;
    swept += 1;

    try {
      if (
        await refundForRow(row.id, ["exportId"], "sweeper.video_export.stuck")
      ) {
        refunded += 1;
      }
    } catch (refundError) {
      console.error(`[Sweeper] Failed to refund videoExport ${row.id}:`, refundError);
    }
  }

  return { swept, refunded };
}

/**
 * Posts are flipped SCHEDULED → PUBLISHING by the scheduler before the run
 * starts, so a dead publish run strands them in PUBLISHING and no future tick
 * re-selects them. Publishing takes seconds; anything stuck there for the
 * processing threshold is dead. Marked FAILED (not re-queued) so a possibly
 * half-published post is never blindly retried — the user can retry manually.
 */
async function sweepPosts(): Promise<number> {
  const res = await prisma.post.updateMany({
    where: {
      status: "PUBLISHING",
      updatedAt: { lt: new Date(Date.now() - PROCESSING_STALE_MS) },
    },
    data: { status: "FAILED", error: STALE_ERROR },
  });
  return res.count;
}

export const stuckJobsSweeper = schedules.task({
  id: "stuck-jobs-sweeper",
  cron: "*/15 * * * *",
  // The sweeps are sequential single-row updates; one instance is plenty and
  // overlapping ticks would only race each other.
  queue: { concurrencyLimit: 1 },
  run: async () => {
    const summary: Record<string, { swept: number; refunded: number }> = {};

    for (const target of SWEEP_TARGETS) {
      try {
        const result = await sweepTarget(target);
        if (result.swept > 0) summary[target.name] = result;
      } catch (sweepError) {
        console.error(`[Sweeper] ${target.name} sweep failed:`, sweepError);
      }
    }

    try {
      const exports = await sweepVideoExports();
      if (exports.swept > 0) summary.videoExport = exports;
    } catch (sweepError) {
      console.error(`[Sweeper] videoExport sweep failed:`, sweepError);
    }

    try {
      const posts = await sweepPosts();
      if (posts > 0) summary.post = { swept: posts, refunded: 0 };
    } catch (sweepError) {
      console.error(`[Sweeper] post sweep failed:`, sweepError);
    }

    if (Object.keys(summary).length > 0) {
      console.warn(`[Sweeper] Reconciled stuck jobs:`, JSON.stringify(summary));
    }

    return summary;
  },
});
