import { task } from "@trigger.dev/sdk";
import prisma from "../lib/db";
import { STANDARD_RETRY, CANCELLED_ERROR } from "./task-utils";
import { WayinAPI } from "../lib/wayin-api";
import {
  limitWayinClips,
  mapWayinStatus,
  syncClippingClips,
} from "../lib/clipping-utils";
import { refundConsumption } from "../lib/credits";

export interface ClippingJobData {
  userId: string;
  clippingId: string;
  videoUrl: string;
  sourceLang?: string | null;
  targetLang?: string | null;
  targetDuration: string;
  query?: string | null;
  limit: number | null;
  enableCaption: boolean;
  captionStyle: string | null;
  ratio?: string | null;
  creditsUsed: number;
  creditTransactionId?: string;
}

export interface ClippingJobResult {
  success: boolean;
  clippingId: string;
  error?: string;
}

export const clippingTask = task({
  id: "ai-clipping",
  queue: { concurrencyLimit: 10 },
  retry: { ...STANDARD_RETRY, maxAttempts: 2 },
  run: async (payload: ClippingJobData): Promise<ClippingJobResult> => {
    const {
      userId,
      clippingId,
      videoUrl,
      sourceLang,
      targetLang,
      targetDuration,
      query,
      limit,
      enableCaption,
      captionStyle,
      ratio,
    } = payload;

    const isFindMoments = Boolean(query?.trim());

    const apiKey = process.env.WAYIN_API_KEY;

    if (!apiKey) throw new Error("WAYIN_API_KEY is not configured");

    const client = new WayinAPI(apiKey);

    const record = await prisma.aIClipping.findUnique({
      where: { id: clippingId },
    });
    
    if (!record) throw new Error(`Clipping job not found: ${clippingId}`);

    await prisma.aIClipping.update({
      where: { id: clippingId },
      data: { status: "PROCESSING" },
    });

    // Phase 1 — detection (no rendering). Detection results are complete at
    // SUCCEEDED; inline export is avoided because Wayin reports SUCCEEDED
    // before rendered clips appear in the results (see WayinAPI.submitClipping).
    let taskId = record.taskId;

    if (!taskId) {
      taskId = await client.submitClipping({
        video_url: videoUrl,
        source_lang: sourceLang ?? null,
        target_lang: targetLang ?? null,
        target_duration: targetDuration,
        query: query ?? null,
        project_name: isFindMoments
          ? `moments-${clippingId}`
          : `clipping-${clippingId}`,
        limit,
      });

      await prisma.aIClipping.update({
        where: { id: clippingId },
        data: { taskId },
      });
    }

    const detection = await client.poll(
      taskId,
      async (progress) => {
        await prisma.aIClipping.update({
          where: { id: clippingId },
          data: {
            // Detection SUCCEEDED is not job completion — clips still render
            // in phase 2, so never surface COMPLETED from here.
            status:
              progress.status === "SUCCEEDED"
                ? "PROCESSING"
                : mapWayinStatus(progress.status),
            metadata: {
              expire_at: progress.expire_at ?? null,
              cost_usage: progress.cost_usage ?? null,
              wayin_status: progress.status,
            },
          },
        });

        if (progress.clips?.length) {
          await syncClippingClips(
            userId,
            clippingId,
            limitWayinClips(progress.clips, limit),
          );
        }
      },
      isFindMoments,
    );

    if (detection.status === "FAILED") {
      throw new Error(detection.error_message || "AI clipping failed");
    }

    // Find-moments ignores the limit param upstream, so enforce it here.
    const keptClips = limitWayinClips(detection.clips, limit);

    if (!keptClips.length) {
      await prisma.aIClipping.update({
        where: { id: clippingId },
        data: {
          status: "COMPLETED",
          metadata: {
            expire_at: detection.expire_at ?? null,
            cost_usage: detection.cost_usage ?? null,
            wayin_status: detection.status,
            clip_count: 0,
          },
        },
      });
      return { success: true, clippingId };
    }

    await syncClippingClips(userId, clippingId, keptClips, {
      pruneOthers: true,
    });

    // Phase 2 — render the kept clips. The export task's SUCCEEDED response
    // contains every rendered clip with its export_link.
    const freshRecord = await prisma.aIClipping.findUnique({
      where: { id: clippingId },
      select: { metadata: true },
    });
    const priorMeta = (freshRecord?.metadata ?? {}) as Record<string, unknown>;

    let exportTaskId =
      typeof priorMeta.export_task_id === "string"
        ? priorMeta.export_task_id
        : null;

    if (!exportTaskId) {
      exportTaskId = await client.submitExport({
        project_id: taskId,
        clip_indices: keptClips.map((clip) => clip.idx),
        target_lang: targetLang ?? null,
        resolution: "FHD_1080",
        enable_caption: enableCaption,
        cc_style_tpl: captionStyle ?? undefined,
        caption_display: targetLang ? "both" : "original",
        ratio: ratio ?? null,
      });

      await prisma.aIClipping.update({
        where: { id: clippingId },
        data: {
          metadata: {
            expire_at: detection.expire_at ?? null,
            cost_usage: detection.cost_usage ?? null,
            wayin_status: "EXPORTING",
            export_task_id: exportTaskId,
          },
        },
      });
    }

    const exported = await client.pollExport(exportTaskId, async (progress) => {
      // Partial exports already carry final links — sync them as they land
      // so the preview fills in progressively.
      if (progress.clips?.length) {
        await syncClippingClips(
          userId,
          clippingId,
          limitWayinClips(progress.clips, limit),
        );
      }
    });

    if (exported.status === "FAILED") {
      throw new Error(exported.error_message || "AI clipping export failed");
    }

    if (exported.clips?.length) {
      await syncClippingClips(
        userId,
        clippingId,
        limitWayinClips(exported.clips, limit),
      );
    }

    await prisma.aIClipping.update({
      where: { id: clippingId },
      data: {
        status: "COMPLETED",
        metadata: {
          expire_at: exported.expire_at ?? detection.expire_at ?? null,
          cost_usage: exported.cost_usage ?? detection.cost_usage ?? null,
          wayin_status: exported.status,
          export_task_id: exportTaskId,
          clip_count: keptClips.length,
        },
      },
    });

    return { success: true, clippingId };
  },
  // Runs only after all retries are exhausted.
  onFailure: async ({ payload, error }) => {
    const message = error instanceof Error ? error.message : String(error);
    await finalizeClipping(payload, message, "ai.clipping.failed");
  },
  // Cancelled runs skip onFailure, so terminal cleanup must happen here too.
  onCancel: async ({ payload }) => {
    await finalizeClipping(payload, CANCELLED_ERROR, "ai.clipping.cancelled");
  },
});

// Shared terminal handler for onFailure/onCancel: mark the row and refund once.
async function finalizeClipping(
  payload: ClippingJobData,
  message: string,
  refundReason: string,
) {
  const { clippingId, creditTransactionId } = payload;

  try {
    await prisma.aIClipping.update({
      where: { id: clippingId },
      data: {
        status: "FAILED",
        error: message,
      },
    });

    if (creditTransactionId) {
      await refundConsumption(creditTransactionId, refundReason, {
        clippingId,
      });
    }
  } catch (updateError) {
    console.error(
      `[AIClipping ${clippingId}] Failed to update clipping status/refund:`,
      updateError,
    );
  }
}

export const addClippingJob = async (
  jobData: ClippingJobData,
  options?: { priority?: number; delay?: number },
) => {
  const handle = await clippingTask.trigger(jobData, {
    delay: options?.delay ? new Date(Date.now() + options.delay) : undefined,
  });
  return { id: handle.id };
};
