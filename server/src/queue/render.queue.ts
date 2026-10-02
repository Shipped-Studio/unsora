import { task } from "@trigger.dev/sdk";
import { renderSubtitleVideo } from "../lib/remotion-render";
import prisma from "../lib/db";
import { createAsset } from "../lib/asset-utils";
import { uploadUrlToStorage } from "../lib/upload";
import { refundConsumption } from "../lib/credits";
import { CANCELLED_ERROR } from "./task-utils";

/**
 * Progress budget allocated to each pipeline phase. The values are
 * percentages (0-100) and must add up to 100.
 *
 * Phases:
 *  - Lambda render:  0  -> RENDER_PROGRESS_CAP
 *  - Storage upload: RENDER_PROGRESS_CAP -> 100
 */
const RENDER_PROGRESS_CAP = 90;

// Job data interface for render processing
export interface RenderProcessingJobData {
  userId: string;
  renderId: string; // Database record ID for the rendered video
  subtitleChunks: any[];
  /** Credits charged for this render at enqueue time. Used for refunds. */
  creditsUsed?: number;
  /** Credit transaction id to refund if the render fails after retries. */
  creditTransactionId?: string;
}

// Job result interface for render processing
export interface RenderProcessingResult {
  success: boolean;
  renderId: string;
  videoUrl?: string;
  error?: string;
  data?: {
    id: string;
    sourceUrl: string;
    outputUrl: string;
    settings: any;
    duration: number;
    fps: number;
    width: number | null;
    height: number | null;
  };
}

export const renderProcessingTask = task({
  id: "render-processing",
  queue: { concurrencyLimit: 10 },
  retry: {
    maxAttempts: 4,
    factor: 2,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 30_000,
    randomize: true,
  },
  run: async (
    payload: RenderProcessingJobData,
  ): Promise<RenderProcessingResult> => {
    const { userId, renderId, subtitleChunks } = payload;

    const render = await prisma.videoExport.findUnique({
      where: { id: renderId },
      include: { sourceAsset: true },
    });

    if (!render) {
      throw new Error(`Export record not found for ID: ${renderId}`);
    }

    await prisma.videoExport.update({
      where: { id: renderId },
      data: { status: "processing", metadata: { progress: 0 } },
    });

    let lastReportedProgress = 0;
    const s3VideoUrl = await renderSubtitleVideo({
      videoUrl: render.sourceAsset!.url,
      subtitleChunks: subtitleChunks as any[],
      settings: render.settings as Record<string, any>,
      duration: render.duration,
      fps: render.fps,
      width: render.width ?? undefined,
      height: render.height ?? undefined,
      onProgress: async (lambdaProgress) => {
        // lambdaProgress is 0..1; map it into the 0..RENDER_PROGRESS_CAP slice
        const next = Math.min(
          RENDER_PROGRESS_CAP,
          Math.round(lambdaProgress * RENDER_PROGRESS_CAP)
        );
        // Persist progress to the export row so the status endpoint can read it.
        if (next > lastReportedProgress) {
          lastReportedProgress = next;
          await prisma.videoExport.update({
            where: { id: renderId },
            data: { metadata: { progress: next } },
          });
        }
      },
    });

    // Ensure the render phase is reflected as fully complete.
    if (lastReportedProgress < RENDER_PROGRESS_CAP) {
      await prisma.videoExport.update({
        where: { id: renderId },
        data: { metadata: { progress: RENDER_PROGRESS_CAP } },
      });
    }

    // Mirror the rendered S3 video to storage so the final asset URL points
    // to our own storage rather than the temporary Lambda output bucket.

    let finalVideoUrl = s3VideoUrl;
    try {
      const uploadResult = await uploadUrlToStorage(
        s3VideoUrl,
        `export-${renderId}.mp4`,
        "exports"
      );

      if (uploadResult.success && uploadResult.fileUrl) {
        finalVideoUrl = uploadResult.fileUrl;
      }
    } catch {
      // Keep Lambda URL on mirror failure
    }

    const outputAsset = await createAsset({
      userId,
      url: finalVideoUrl,
      name: `Export ${renderId}`,
      type: "VIDEO",
      source: "EXPORT",
    });
    const savedExport = await prisma.videoExport.update({
      where: { id: renderId },
      data: {
        outputAssetId: outputAsset.id,
        status: "completed",
        metadata: { progress: 100 },
      },
      include: { sourceAsset: true, outputAsset: true },
    });

    return {
      success: true,
      renderId: savedExport.id,
      videoUrl: finalVideoUrl,
      data: {
        id: savedExport.id,
        sourceUrl: savedExport.sourceAsset?.url || "",
        outputUrl: savedExport.outputAsset?.url || "",
        settings: savedExport.settings,
        duration: savedExport.duration,
        fps: savedExport.fps,
        width: savedExport.width,
        height: savedExport.height,
      },
    };
  },
  // Runs only after all retries are exhausted — mark failed + refund once.
  onFailure: async ({ payload, error }) => {
    const message = error instanceof Error ? error.message : "Rendering failed";
    await finalizeRender(payload, message, "video.export.subtitle.failed");
  },
  // Cancelled runs skip onFailure, so terminal cleanup must happen here too.
  onCancel: async ({ payload }) => {
    await finalizeRender(payload, CANCELLED_ERROR, "video.export.subtitle.cancelled");
  },
});

// Shared terminal handler for onFailure/onCancel: mark the row and refund once.
async function finalizeRender(
  payload: RenderProcessingJobData,
  message: string,
  refundReason: string,
) {
  const { renderId, creditTransactionId } = payload;

  console.error(`[Render ${renderId}] Final failure: ${message}`);

  try {
    const existing = await prisma.videoExport.findUnique({
      where: { id: renderId },
    });

    if (existing) {
      await prisma.videoExport.update({
        where: { id: renderId },
        data: { status: "failed", error: message },
      });
    }
  } catch (updateError) {
    console.error(
      `[Render ${renderId}] Failed to update render status:`,
      updateError
    );
  }

  if (creditTransactionId) {
    try {
      await refundConsumption(creditTransactionId, refundReason, { renderId });
    } catch (refundError) {
      console.error(
        `[Render ${renderId}] Failed to refund credits for txn ${creditTransactionId}:`,
        refundError
      );
    }
  }
}

// Helper function to add a render processing job. `jobId` (the export taskId)
// is used as the idempotency key to dedupe repeat submissions.
export const addRenderProcessingJob = async (
  jobData: RenderProcessingJobData,
  options?: {
    priority?: number;
    delay?: number;
    jobId?: string;
  }
) => {
  const handle = await renderProcessingTask.trigger(jobData, {
    delay: options?.delay ? new Date(Date.now() + options.delay) : undefined,
    idempotencyKey: options?.jobId,
    idempotencyKeyTTL: "1h",
  });
  return { id: handle.id };
};

// Render status for the export polling endpoint. Derived from the videoExport
// row (keyed by its unique taskId) now that BullMQ job introspection is gone.
export const getRenderJobStatus = async (taskId: string) => {
  const row = await prisma.videoExport.findUnique({
    where: { taskId },
    include: { outputAsset: true },
  });

  if (!row) {
    return null;
  }

  const meta = (row.metadata as { progress?: number } | null) ?? {};
  const isCompleted = row.status === "completed";
  const isFailed = row.status === "failed";

  return {
    id: taskId,
    progress: isCompleted ? 100 : meta.progress ?? 0,
    processedOn: row.createdAt,
    finishedOn: isCompleted ? row.createdAt : null,
    failedReason: isFailed ? row.error ?? "Rendering failed" : null,
    data: row,
    returnvalue: isCompleted
      ? {
          success: true,
          renderId: row.id,
          videoUrl: row.outputAsset?.url,
        }
      : undefined,
  };
};
