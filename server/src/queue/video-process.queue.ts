import { task } from "@trigger.dev/sdk";
import { WavespeedAPI, WavespeedResult, getWavespeedClient } from "../lib/wavespeed-api";
import prisma from "../lib/db";
import { uploadVideoToStorage } from "../lib/upload";
import { puppeteerService } from "../lib/puppeteer-service";
import { SHORT_RETRY, CANCELLED_ERROR } from "./task-utils";
import { createAsset, createVideoAssetWithProbe } from "../lib/asset-utils";
import { refundConsumption } from "../lib/credits";

export interface VideoProcessingJobData {
  userId: string;
  method: string;
  video: {
    videoUrl: string;
    originalName: string;
    dbVideoId?: string;
  };
  operations: string[];
  creditsUsed: number;
  /** Credit transaction id to refund on failure. */
  creditTransactionId?: string;
}

export interface VideoProcessingResult {
  success: boolean;
  originalName: string;
  outputUrl?: string;
  error?: string;
  dbVideoId: string;
  creditsUsed: number;
}

async function submitAndPoll(
  client: WavespeedAPI,
  existingTaskId: string | null | undefined,
  model: string,
  input: Record<string, unknown>,
  onTaskId: (taskId: string) => Promise<void>,
): Promise<WavespeedResult> {
  let taskId = existingTaskId;

  if (!taskId) {
    taskId = await client.submit(model, input);
    await onTaskId(taskId);
  }

  return client.poll(taskId);
}

export const videoProcessingTask = task({
  id: "video-processing",
  queue: { concurrencyLimit: 10 },
  retry: SHORT_RETRY,
  run: async (
    payload: VideoProcessingJobData,
    { ctx },
  ): Promise<VideoProcessingResult> => {
    const { userId, method, video, operations, creditsUsed } = payload;

    const client = getWavespeedClient();

    try {
      if (!video.dbVideoId) {
        throw new Error("Database video ID is required but not provided");
      }

      const processedVideo = await prisma.processedVideo.findUnique({
        where: { id: video.dbVideoId },
        include: { processedAsset: true, originalAsset: true, intermediateAsset: true },
      });

      if (!processedVideo) {
        throw new Error(
          `Database record not found for ID: ${video.dbVideoId}`,
        );
      }

      if (processedVideo.processedAssetId) {
        return {
          success: true,
          originalName: video.originalName,
          outputUrl: processedVideo.processedAsset?.url,
          dbVideoId: processedVideo.id,
          creditsUsed,
        };
      }

      if (method === "url" && !processedVideo.originalAssetId) {
        const isWebpage =
          video.videoUrl.includes("sora.chatgpt.com") ||
          video.videoUrl.includes("openai.com") ||
          (!video.videoUrl.endsWith(".mp4") &&
            !video.videoUrl.endsWith(".webm") &&
            !video.videoUrl.endsWith(".mov") &&
            !video.videoUrl.includes("blob:"));

        let videoUrlToProcess = video.videoUrl;

        if (isWebpage) {
          const videoSources = await puppeteerService.extractVideoSources(
            video.videoUrl,
          );

          if (videoSources.length === 0) {
            throw new Error("No video sources found on the webpage");
          }

          videoUrlToProcess = videoSources[0].videoUrl;
        }

        const { fileUrl } = await uploadVideoToStorage(
          videoUrlToProcess,
          video.originalName,
        );

        if (!fileUrl) {
          throw new Error("Failed to upload video to storage");
        }

        const originalAsset = await createAsset({
          userId,
          url: fileUrl,
          name: video.originalName,
          type: "VIDEO",
          source: "PROCESSING",
        });
        await prisma.processedVideo.update({
          where: { id: video.dbVideoId },
          data: { originalAssetId: originalAsset.id },
        });

        video.videoUrl = fileUrl;
      } else if (processedVideo.originalAsset?.url) {
        video.videoUrl = processedVideo.originalAsset.url;
      }

      await prisma.processedVideo.update({
        where: { id: processedVideo.id },
        data: { status: "processing" },
      });

      const dbId = processedVideo.id;

      let outputVideoUrl: string | undefined;
      let lastTaskId: string | undefined;

      const hasWatermark = operations.includes("watermark_removal");
      const hasUpscale = operations.includes("upscaling");

      if (hasWatermark && hasUpscale) {
        // ── Two-step pipeline: watermark removal → upscale ──────────
        //
        // State machine based on DB fields:
        //   intermediateUrl=null  + taskId=null   → fresh start, submit step 1
        //   intermediateUrl=null  + taskId=X      → step 1 in progress, resume polling X
        //   intermediateUrl=set   + taskId=null   → step 1 done, step 2 not started, submit step 2
        //   intermediateUrl=set   + taskId=X      → step 2 in progress, resume polling X

        const { intermediateAssetId, taskId: existingTaskId } = processedVideo;
        let cleanedVideoUrl = processedVideo.intermediateAsset?.url || null;

        if (!cleanedVideoUrl) {
          // Step 1: watermark removal (submit or resume)

          const { model, input } = WavespeedAPI.watermarkRemovalInput(
            video.videoUrl,
          );

          const wmResult = await submitAndPoll(
            client,
            existingTaskId,
            model,
            input,
            async (tid) => {
              await prisma.processedVideo.update({
                where: { id: dbId },
                data: { taskId: tid },
              });
            },
          );

          if (wmResult.status === "failed") {
            await prisma.processedVideo.update({
              where: { id: dbId },
              data: {
                status: "failed",
                error: wmResult.error,
                taskId: wmResult.taskId,
              },
            });
            return {
              success: false,
              originalName: video.originalName,
              error: wmResult.error,
              dbVideoId: dbId,
              creditsUsed,
            };
          }

          cleanedVideoUrl = wmResult.outputs[0];

          const intermediateUpload =
            await uploadVideoToStorage(cleanedVideoUrl);
          if (intermediateUpload.success && intermediateUpload.fileUrl) {
            cleanedVideoUrl = intermediateUpload.fileUrl;
          }

          // Mark step 1 as done: save intermediateAssetId, clear taskId
          const intermediateAsset = await createAsset({
            userId,
            url: cleanedVideoUrl,
            name: `${video.originalName} intermediate`,
            type: "VIDEO",
            source: "PROCESSING",
          });
          await prisma.processedVideo.update({
            where: { id: dbId },
            data: { intermediateAssetId: intermediateAsset.id, taskId: null },
          });
        }

        // Step 2: upscale (submit or resume)

        // Re-read taskId — it was cleared after step 1 or set during a previous step 2 attempt
        const fresh = await prisma.processedVideo.findUnique({
          where: { id: dbId },
          select: { taskId: true },
        });

        const { model: upModel, input: upInput } =
          WavespeedAPI.videoUpscaleInput(cleanedVideoUrl);

        const upResult = await submitAndPoll(
          client,
          fresh?.taskId,
          upModel,
          upInput,
          async (tid) => {
            await prisma.processedVideo.update({
              where: { id: dbId },
              data: { taskId: tid },
            });
          },
        );

        if (upResult.status === "failed") {
          throw new Error(upResult.error || "Video upscale failed");
        }

        outputVideoUrl = upResult.outputs[0];
        lastTaskId = upResult.taskId;
      } else if (hasWatermark) {
        // ── Single step: watermark removal ──────────────────────────

        const { model, input } = WavespeedAPI.watermarkRemovalInput(
          video.videoUrl,
        );
        const result = await submitAndPoll(
          client,
          processedVideo.taskId,
          model,
          input,
          async (tid) => {
            await prisma.processedVideo.update({
              where: { id: dbId },
              data: { taskId: tid },
            });
          },
        );

        if (result.status === "failed") {
          throw new Error(result.error || "Watermark removal failed");
        }

        outputVideoUrl = result.outputs[0];
        lastTaskId = result.taskId;
      } else if (hasUpscale) {
        // ── Single step: upscale ────────────────────────────────────

        const { model, input } = WavespeedAPI.videoUpscaleInput(
          video.videoUrl,
        );
        const result = await submitAndPoll(
          client,
          processedVideo.taskId,
          model,
          input,
          async (tid) => {
            await prisma.processedVideo.update({
              where: { id: dbId },
              data: { taskId: tid },
            });
          },
        );

        if (result.status === "failed") {
          throw new Error(result.error || "Video upscale failed");
        }

        outputVideoUrl = result.outputs[0];
        lastTaskId = result.taskId;
      } else {
        throw new Error("No valid operations specified");
      }

      if (!outputVideoUrl) {
        throw new Error("No output video URL returned from provider");
      }

      const upload = await uploadVideoToStorage(outputVideoUrl);
      const fileUrl = upload.fileUrl;
      if (!fileUrl) {
        throw new Error("Failed to upload processed video to storage");
      }

      const processedAsset = await createVideoAssetWithProbe({
        userId,
        url: fileUrl,
        name: `${video.originalName} processed`,
        source: "PROCESSING",
      });
      await prisma.processedVideo.update({
        where: { id: dbId },
        data: {
          status: "completed",
          processedAssetId: processedAsset.id,
          taskId: lastTaskId,
        },
      });

      // Credit accounting was settled at queue time via consumeCredits().

      return {
        success: true,
        originalName: video.originalName,
        outputUrl: outputVideoUrl,
        dbVideoId: dbId,
        creditsUsed,
      };
    } catch (error) {
      console.error(`[video-processing ${ctx.run.id}]`, error);

      try {
        if (video.dbVideoId) {
          await prisma.processedVideo.update({
            where: { id: video.dbVideoId },
            data: {
              status: "failed",
              error:
                error instanceof Error ? error.message : "Processing failed",
            },
          });
        }
      } catch (updateError) {
        console.error(
          `[video-processing ${ctx.run.id}] Failed to update video status:`,
          updateError,
        );
      }

      throw error;
    }
  },
  // Runs only after all retries are exhausted. The run()'s catch block already
  // marked the row failed, so this only settles the refund.
  onFailure: async ({ payload, error }) => {
    const { creditTransactionId, video } = payload;
    const message = error instanceof Error ? error.message : String(error);

    console.error(
      `[video-processing] Final failure for ${video.dbVideoId}: ${message}`,
    );

    try {
      if (creditTransactionId) {
        await refundConsumption(
          creditTransactionId,
          "video.processing.failed",
          { processedVideoId: video.dbVideoId },
        );
      }
    } catch (refundError) {
      console.error(`[video-processing] Failed to refund credits:`, refundError);
    }
  },
  // Cancelled runs skip both the run()'s catch block and onFailure, so mark
  // the row terminal AND refund here.
  onCancel: async ({ payload }) => {
    const { creditTransactionId, video } = payload;

    try {
      await prisma.processedVideo.update({
        where: { id: video.dbVideoId },
        data: { status: "failed", error: CANCELLED_ERROR },
      });

      if (creditTransactionId) {
        await refundConsumption(
          creditTransactionId,
          "video.processing.cancelled",
          { processedVideoId: video.dbVideoId },
        );
      }
    } catch (cancelError) {
      console.error(
        `[video-processing] Failed to update DB/refund on cancel:`,
        cancelError,
      );
    }
  },
});

export const addVideoProcessingJob = async (
  jobData: VideoProcessingJobData,
  options?: { priority?: number; delay?: number },
) => {
  const handle = await videoProcessingTask.trigger(jobData, {
    delay: options?.delay ? new Date(Date.now() + options.delay) : undefined,
  });
  return { id: handle.id };
};

export const addVideoProcessingBatch = async (
  method: string,
  videos: Array<{
    videoUrl: string;
    originalName: string;
    dbVideoId?: string;
  }>,
  userId: string,
  operations: string[],
  perVideoCredits: Array<{
    creditsUsed: number;
    creditTransactionId?: string;
  }>,
  options?: { priority?: number; delay?: number },
) => {
  const jobs = await Promise.all(
    videos.map((video, i) =>
      addVideoProcessingJob(
        {
          userId,
          method,
          video,
          operations,
          creditsUsed: perVideoCredits[i]?.creditsUsed ?? 0,
          creditTransactionId: perVideoCredits[i]?.creditTransactionId,
        },
        options,
      ),
    ),
  );

  return {
    jobs,
    jobIds: jobs.map((job) => job.id),
  };
};
