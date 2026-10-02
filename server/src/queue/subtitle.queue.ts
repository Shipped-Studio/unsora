import { task } from "@trigger.dev/sdk";
import { Input, FilePathSource, MP4 } from "mediabunny";
import { transcribeVideo, groupWordsIntoChunks } from "../lib/transcription";
import { downloadVideo } from "../lib/audio";
import fs from "fs";
import path from "path";
import prisma from "../lib/db";
import { renderSubtitleVideo } from "../lib/remotion-render";
import {
  updateTranscriptionStatus,
  updateTranscriptionData,
  updateTranscriptionError,
  createVideoExport,
} from "../services/subtitle.service";
import { getUserByClerkId } from "../services/user.service";
import { uploadUrlToStorage } from "../lib/upload";
import { CANCELLED_ERROR } from "./task-utils";

export interface SubtitleProcessingJobData {
  userId: string;
  videoUrl: string;
  transcriptionId?: string;
  style?: any;
  /** ISO-639-1 code passed to Whisper; omit for auto-detect. */
  language?: string;
}

export interface SubtitleProcessingResult {
  success: boolean;
  transcriptionId: string;
  error?: string;
  data?: {
    id: string;
    text: string;
    language: string;
    duration: number;
    segments: any[];
    subtitleChunks: any[];
  };
}

export const subtitleProcessingTask = task({
  id: "subtitle-processing",
  queue: { concurrencyLimit: 10 },
  retry: {
    maxAttempts: 4,
    factor: 2,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 30_000,
    randomize: true,
  },
  run: async (
    payload: SubtitleProcessingJobData,
    { ctx },
  ): Promise<SubtitleProcessingResult> => {
    const { userId, videoUrl, transcriptionId, style, language } = payload;

    const tempDir = path.join(process.cwd(), "temp");
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const tempVideoPath = path.join(tempDir, `video_${uniqueSuffix}.mp4`);

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const dbTranscriptionId = transcriptionId as string;

    try {
      const user = await getUserByClerkId(userId);
      if (!user) {
        throw new Error("User not found");
      }

      await updateTranscriptionStatus(dbTranscriptionId, "processing");

      await downloadVideo(videoUrl, tempVideoPath);

      if (!fs.existsSync(tempVideoPath)) {
        throw new Error(
          "Video download failed - file not found after download",
        );
      }

      const stats = fs.statSync(tempVideoPath);
      if (stats.size === 0) {
        throw new Error("Video download failed - downloaded file is empty");
      }

      let videoDimensions = { width: 1920, height: 1080 };
      try {
        const input = new Input({
          formats: [MP4],
          source: new FilePathSource(tempVideoPath),
        });
        const videoTrack = await input.getPrimaryVideoTrack();
        if (videoTrack) {
          videoDimensions = {
            width: videoTrack.displayWidth,
            height: videoTrack.displayHeight,
          };
        }
        input.dispose();
      } catch {
        // Fall back to defaults
      }

      const transcription = await transcribeVideo(tempVideoPath, language);

      // Group word timestamps into evenly-sized chunks. Whisper's raw
      // segments are sentence-length and wildly inconsistent on screen.
      const existingRow = await prisma.transcription.findUnique({
        where: { id: dbTranscriptionId },
        select: { maxWordsPerChunk: true },
      });
      const maxWordsPerChunk = existingRow?.maxWordsPerChunk || 5;
      const allWords = transcription.segments.flatMap((s) => s.words);
      const subtitleChunks = allWords.length
        ? groupWordsIntoChunks(allWords, maxWordsPerChunk)
        : transcription.segments;

      const savedTranscription = await updateTranscriptionData(
        dbTranscriptionId,
        {
          text: transcription.text,
          language: transcription.language,
          duration: transcription.duration,
          segments: transcription.segments,
          subtitleChunks,
          maxWordsPerChunk,
          width: videoDimensions.width,
          height: videoDimensions.height,
        },
      );

      // Transcription is done — mark it completed so the user can use it
      // even if the optional render step below fails.
      await updateTranscriptionStatus(savedTranscription.id, "completed");

      // Best-effort render; failure does NOT revert transcription status.
      if (style) {
        try {
          const s3VideoUrl = await renderSubtitleVideo({
            videoUrl,
            subtitleChunks: subtitleChunks as any[],
            settings: style as Record<string, any>,
            duration: transcription.duration,
            fps: 30,
            width: savedTranscription.width || videoDimensions.width,
            height: savedTranscription.height || videoDimensions.height,
          });

          // Mirror the rendered S3 video to storage so the export URL points
          // to our own storage rather than the temporary Lambda output bucket.
          let finalVideoUrl = s3VideoUrl;
          try {
            const uploadResult = await uploadUrlToStorage(
              s3VideoUrl,
              `export-${savedTranscription.id}.mp4`,
              "exports",
            );
            if (uploadResult.success && uploadResult.fileUrl) {
              finalVideoUrl = uploadResult.fileUrl;
            }
          } catch {
            // Keep Lambda URL on mirror failure
          }

          await createVideoExport({
            userId: user.id,
            transcriptionId: savedTranscription.id,
            sourceUrl: videoUrl,
            outputUrl: finalVideoUrl,
            settings: style as any,
            duration: transcription.duration,
            fps: 30,
            width: savedTranscription.width || videoDimensions.width,
            height: savedTranscription.height || videoDimensions.height,
          });
        } catch (renderError) {
          console.error(
            `[Subtitle ${ctx.run.id}] Render failed (transcription still available):`,
            renderError,
          );
        }
      }

      return {
        success: true,
        transcriptionId: savedTranscription.id,
        data: {
          id: savedTranscription.id,
          text: transcription.text,
          language: transcription.language,
          duration: transcription.duration,
          segments: transcription.segments,
          subtitleChunks,
        },
      };
    } catch (error) {
      console.error(`[Subtitle ${ctx.run.id}] Processing error:`, error);

      try {
        await updateTranscriptionError(
          dbTranscriptionId,
          error instanceof Error ? error.message : "Processing failed",
        );
      } catch {
        // Best effort — don't mask the original error
      }

      throw error;
    } finally {
      if (fs.existsSync(tempVideoPath)) {
        try {
          fs.unlinkSync(tempVideoPath);
        } catch {
          // Cleanup failure is non-critical
        }
      }
    }
  },
  // Failures are marked per-attempt by the run()'s catch block, but cancelled
  // runs skip it — mark the transcription failed here so it doesn't spin forever.
  onCancel: async ({ payload }) => {
    if (!payload.transcriptionId) return;
    try {
      await updateTranscriptionError(payload.transcriptionId, CANCELLED_ERROR);
    } catch (cancelError) {
      console.error(
        `[Subtitle ${payload.transcriptionId}] Failed to mark cancelled:`,
        cancelError,
      );
    }
  },
});

// Helper function to add a subtitle processing job
export const addSubtitleProcessingJob = async (
  jobData: SubtitleProcessingJobData,
  options?: {
    priority?: number;
    delay?: number;
  },
) => {
  const handle = await subtitleProcessingTask.trigger(jobData, {
    delay: options?.delay ? new Date(Date.now() + options.delay) : undefined,
  });
  return { id: handle.id };
};

// Queue statistics for the admin/monitoring endpoint. Derived from the
// transcription table now that BullMQ queue introspection is gone.
export const getSubtitleQueueStats = async () => {
  const [active, completed, failed, waiting] = await Promise.all([
    prisma.transcription.count({ where: { status: "processing" } }),
    prisma.transcription.count({ where: { status: "completed" } }),
    prisma.transcription.count({ where: { status: "failed" } }),
    prisma.transcription.count({
      where: { status: { notIn: ["processing", "completed", "failed"] } },
    }),
  ]);

  return { waiting, active, completed, failed };
};
