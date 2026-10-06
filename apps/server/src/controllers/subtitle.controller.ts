import { Request, Response } from "express";
import { groupWordsIntoChunks } from "../lib/transcription";
import prisma from "../lib/db";
import {
  addSubtitleProcessingJob,
  getSubtitleQueueStats,
} from "../queue/subtitle.queue";
import { createAsset } from "../lib/asset-utils";
import { DURATION_TOLERANCE_SECONDS, measureMediaSeconds } from "../lib/media-limits";

/*
 * Transcription is free (exports are what's charged), so it's bounded
 * instead: a few running at once per user, and a maximum video length.
 */
const MAX_ACTIVE_TRANSCRIPTIONS = 3;
const MAX_TRANSCRIPTION_SECONDS = 30 * 60;
const ACTIVE_TRANSCRIPTION_STATUSES = ["queued", "pending", "processing"];
/** Rows "active" for longer than this are presumed dead, not counted. */
const ACTIVE_TRANSCRIPTION_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Why the user can't transcribe these videos right now, or null if they can.
 */
async function transcriptionLimitError(
  userId: string,
  videoUrls: string[],
): Promise<{ status: number; error: string } | null> {
  const active = await prisma.transcription.count({
    where: {
      userId,
      status: { in: ACTIVE_TRANSCRIPTION_STATUSES },
      updatedAt: { gte: new Date(Date.now() - ACTIVE_TRANSCRIPTION_WINDOW_MS) },
    },
  });
  if (active + videoUrls.length > MAX_ACTIVE_TRANSCRIPTIONS) {
    return {
      status: 429,
      error: `You can transcribe up to ${MAX_ACTIVE_TRANSCRIPTIONS} videos at once. Wait for one to finish and try again.`,
    };
  }
  for (const url of videoUrls) {
    const seconds = await measureMediaSeconds(url);
    if (!seconds) {
      return {
        status: 400,
        error: "Couldn't read the video's length. Upload an MP4, WebM or MOV file.",
      };
    }
    if (seconds > MAX_TRANSCRIPTION_SECONDS + DURATION_TOLERANCE_SECONDS) {
      return {
        status: 400,
        error: `Videos can be up to ${MAX_TRANSCRIPTION_SECONDS / 60} minutes long.`,
      };
    }
  }
  return null;
}

export class SubtitleController {
  /**
   * Create a transcription record without starting processing.
   * The client triggers processing later via POST /:id/start.
   */
  async createTranscription(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const {
        videoUrl,
        filename,
        maxWordsPerChunk = 5,
        inputLanguage = "auto",
        width,
        height,
      } = req.body;

      if (!videoUrl) {
        return res
          .status(400)
          .json({ success: false, error: "Video URL is required" });
      }

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const videoAsset = await createAsset({
        userId: user.id,
        url: videoUrl,
        name: filename || "Transcription video",
        type: "VIDEO",
        source: "UPLOAD",
      });
      const transcription = await prisma.transcription.create({
        data: {
          userId: user.id,
          videoAssetId: videoAsset.id,
          filename,
          text: "",
          language: inputLanguage === "auto" ? "unknown" : inputLanguage,
          duration: 0,
          width: width || 1920,
          height: height || 1080,
          segments: "[]",
          subtitleChunks: "[]",
          maxWordsPerChunk,
          status: "draft",
        },
      });

      res.status(201).json({
        success: true,
        data: {
          id: transcription.id,
          status: "draft",
          filename,
          width: width || 1920,
          height: height || 1080,
        },
      });
    } catch (error) {
      console.error("Error creating transcription:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create transcription",
      });
    }
  }

  /**
   * Start transcription processing for an existing draft record.
   */
  async startTranscription(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const { id } = req.params;
      const { language, maxWordsPerChunk } = (req.body ?? {}) as {
        language?: string;
        maxWordsPerChunk?: number;
      };

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const transcription = await prisma.transcription.findFirst({
        where: { id, userId: user.id },
        include: { videoAsset: true },
      });

      if (!transcription) {
        return res
          .status(404)
          .json({ success: false, error: "Transcription not found" });
      }

      if (
        transcription.status !== "draft" &&
        transcription.status !== "failed" &&
        transcription.status !== "completed"
      ) {
        return res.status(400).json({
          success: false,
          error: `Cannot start transcription in "${transcription.status}" status`,
        });
      }

      const limit = await transcriptionLimitError(user.id, [
        transcription.videoAsset!.url,
      ]);
      if (limit) {
        return res
          .status(limit.status)
          .json({ success: false, error: limit.error });
      }

      const isRerun = transcription.status === "completed";
      // "auto" means let Whisper detect; anything else is an ISO-639-1 code
      const whisperLanguage =
        language && language !== "auto" ? language : undefined;

      await prisma.transcription.update({
        where: { id },
        data: {
          status: "pending",
          error: null,
          ...(language ? { language } : {}),
          ...(maxWordsPerChunk && maxWordsPerChunk >= 1
            ? { maxWordsPerChunk }
            : {}),
          ...(isRerun
            ? {
                text: "",
                segments: "[]",
                subtitleChunks: "[]",
              }
            : {}),
        },
      });

      const job = await addSubtitleProcessingJob({
        userId: clerkUserId,
        videoUrl: transcription.videoAsset!.url,
        transcriptionId: transcription.id,
        language: whisperLanguage,
      });

      res.status(202).json({
        success: true,
        data: {
          id: transcription.id,
          taskId: job.id || "",
          status: "pending",
        },
      });
    } catch (error) {
      console.error("Error starting transcription:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to start transcription",
      });
    }
  }

  /**
   * Queue multiple videos for transcription processing (batch method)
   */
  async queueBatchTranscribeVideos(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const { videos } = req.body; // Array of { videoUrl, filename, maxWordsPerChunk, language }

      if (!videos || !Array.isArray(videos) || videos.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Videos array is required and must not be empty",
        });
      }

      if (videos.length > 10) {
        return res.status(400).json({
          success: false,
          error: "Maximum 10 videos allowed per batch",
        });
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const limit = await transcriptionLimitError(
        user.id,
        videos.map((v: { videoUrl?: unknown }) => String(v?.videoUrl ?? "")),
      );
      if (limit) {
        return res
          .status(limit.status)
          .json({ success: false, error: limit.error });
      }

      const results: {
        success: boolean;
        error?: string;
        filename?: string;
        data?: {
          id: string;
          taskId: string;
          status: string;
          filename?: string;
          width?: number;
          height?: number;
        };
      }[] = [];

      // Process each video
      for (const video of videos) {
        const {
          videoUrl,
          filename,
          maxWordsPerChunk = 5,
          inputLanguage = "auto",
          outputLanguage = "en",
          width,
          height,
          style,
        } = video;

        if (!videoUrl) {
          results.push({
            success: false,
            error: "Video URL is required",
            filename,
          });
          continue;
        }

        try {
          const videoAsset = await createAsset({
            userId: user.id,
            url: videoUrl,
            name: filename || "Batch transcription video",
            type: "VIDEO",
            source: "UPLOAD",
          });
          const transcription = await prisma.transcription.create({
            data: {
              userId: user.id,
              videoAssetId: videoAsset.id,
              filename,
              text: "",
              language: inputLanguage === "auto" ? "unknown" : inputLanguage,
              duration: 0,
              width: width || 1920,
              height: height || 1080,
              segments: "[]",
              subtitleChunks: "[]",
              maxWordsPerChunk,
              status: "pending",
            },
          });

          // Add job to queue
          const job = await addSubtitleProcessingJob({
            userId: clerkUserId,
            videoUrl,
            transcriptionId: transcription.id,
            style: style,
          });

          results.push({
            success: true,
            data: {
              id: transcription.id,
              taskId: job.id || "",
              status: "pending",
              filename,
              width: width || 1920,
              height: height || 1080,
            },
          });
        } catch (error) {
          console.error(`Error processing video ${filename}:`, error);
          results.push({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to process video",
            filename,
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      res.status(202).json({
        success: true,
        data: {
          results,
          summary: {
            total: videos.length,
            successful: successCount,
            failed: failureCount,
          },
          message: `${successCount} video${
            successCount !== 1 ? "s" : ""
          } queued for transcription processing`,
        },
      });
    } catch (error) {
      console.error("Error queueing videos for batch transcription:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to queue videos for batch transcription",
      });
    }
  }

  /**
   * Queue video for transcription processing (new queue-based method)
   */
  async queueTranscribeVideo(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const {
        videoUrl,
        maxWordsPerChunk = 5,
        filename,
        inputLanguage = "auto",
        outputLanguage = "en",
      } = req.body;

      if (!videoUrl) {
        return res.status(400).json({
          success: false,
          error: "Video URL is required",
        });
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const limit = await transcriptionLimitError(user.id, [videoUrl]);
      if (limit) {
        return res
          .status(limit.status)
          .json({ success: false, error: limit.error });
      }

      const videoAsset = await createAsset({
        userId: user.id,
        url: videoUrl,
        name: filename || "Transcription video",
        type: "VIDEO",
        source: "UPLOAD",
      });
      const transcription = await prisma.transcription.create({
        data: {
          userId: user.id,
          videoAssetId: videoAsset.id,
          filename,
          text: "",
          language: inputLanguage === "auto" ? "unknown" : inputLanguage,
          duration: 0,
          width: 1920,
          height: 1080,
          segments: "[]",
          subtitleChunks: "[]",
          status: "pending",
        },
      });

      const job = await addSubtitleProcessingJob({
        userId: clerkUserId,
        videoUrl,
        transcriptionId: transcription.id,
      });

      res.status(202).json({
        success: true,
        data: {
          id: transcription.id,
          taskId: job.id,
          status: "pending",
          message: "Video queued for transcription processing",
        },
      });
    } catch (error) {
      console.error("Error queueing video for transcription:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to queue video for transcription",
      });
    }
  }

  /**
   * Get transcription status and job progress
   */
  async getTranscriptionStatus(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const transcription = await prisma.transcription.findFirst({
        where: {
          id,
          userId: user.id,
        },
      });

      if (!transcription) {
        return res.status(404).json({
          success: false,
          error: "Transcription not found",
        });
      }

      res.status(200).json({
        success: true,
        data: {
          id: transcription.id,
          status: transcription.status,
          error: transcription.error,
          progress:
            transcription.status === "completed"
              ? 100
              : transcription.status === "processing"
              ? 50
              : 0,
        },
      });
    } catch (error) {
      console.error("Error getting transcription status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get transcription status",
      });
    }
  }

  /**
   * Get queue statistics (admin/monitoring endpoint)
   */
  async getQueueStats(req: Request, res: Response) {
    try {
      const stats = await getSubtitleQueueStats();
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Error getting queue stats:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get queue statistics",
      });
    }
  }

  /**
   * Get transcription by ID
   */
  async getTranscription(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const transcription = await prisma.transcription.findFirst({
        where: {
          id,
          userId: user.id,
        },
        include: {
          videoAsset: true,
          videoExports: {
            include: { outputAsset: true },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!transcription) {
        return res.status(404).json({
          success: false,
          error: "Transcription not found",
        });
      }

      res.status(200).json({
        success: true,
        data: transcription,
      });
    } catch (error) {
      console.error("Error getting transcription:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get transcription",
      });
    }
  }

  /**
   * Update transcription fields (title, subtitleChunks, etc.)
   */
  async updateTranscription(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const { id } = req.params;
      const { title, subtitleChunks, editorSettings, maxWordsPerChunk } =
        req.body;

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const transcription = await prisma.transcription.findFirst({
        where: { id, userId: user.id },
      });

      if (!transcription) {
        return res
          .status(404)
          .json({ success: false, error: "Transcription not found" });
      }

      const updateData: Record<string, any> = {};
      if (title !== undefined) updateData.title = title;
      if (subtitleChunks !== undefined)
        updateData.subtitleChunks = JSON.stringify(subtitleChunks);
      if (editorSettings !== undefined)
        updateData.editorSettings = editorSettings;
      if (typeof maxWordsPerChunk === "number" && maxWordsPerChunk >= 1)
        updateData.maxWordsPerChunk = maxWordsPerChunk;

      const updated = await prisma.transcription.update({
        where: { id },
        data: updateData,
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("Error updating transcription:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update transcription",
      });
    }
  }

  /**
   * Update subtitle chunks (regenerate with different maxWordsPerChunk)
   */
  async updateSubtitleChunks(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const { id } = req.params;
      const { maxWordsPerChunk } = req.body;

      if (!maxWordsPerChunk || maxWordsPerChunk < 1) {
        return res.status(400).json({
          success: false,
          error: "Invalid maxWordsPerChunk value",
        });
      }

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const transcription = await prisma.transcription.findFirst({
        where: {
          id,
          userId: user.id,
        },
      });

      if (!transcription) {
        return res.status(404).json({
          success: false,
          error: "Transcription not found",
        });
      }

      // Parse existing segments
      const segments = JSON.parse(transcription.segments as string);
      const allWords = segments.flatMap((segment: any) => segment.words);

      // Regenerate subtitle chunks
      const subtitleChunks = groupWordsIntoChunks(allWords, maxWordsPerChunk);

      // Update database
      await prisma.transcription.update({
        where: { id },
        data: {
          maxWordsPerChunk,
          subtitleChunks: JSON.stringify(subtitleChunks),
        },
      });

      res.status(200).json({
        success: true,
        data: {
          subtitleChunks,
        },
      });
    } catch (error) {
      console.error("Error updating subtitle chunks:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update subtitle chunks",
      });
    }
  }

  /**
   * Get all transcriptions for current user
   */
  async getUserTranscriptions(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      // Get pagination parameters from query
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 12;
      const offset = (page - 1) * limit;

      // Validate pagination parameters
      if (page < 1) {
        return res.status(400).json({
          success: false,
          error: "Page must be greater than 0",
        });
      }

      if (limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          error: "Limit must be between 1 and 100",
        });
      }

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Get total count for pagination
      const totalCount = await prisma.transcription.count({
        where: { userId: user.id },
      });

      const transcriptions = await prisma.transcription.findMany({
        where: {
          userId: user.id,
        },
        include: {
          videoAsset: true,
          videoExports: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: offset,
        take: limit,
      });

      const totalPages = Math.ceil(totalCount / limit);

      res.status(200).json({
        success: true,
        data: transcriptions.map((t) => ({
          id: t.id,
          videoUrl: t.videoAsset?.url,
          filename: t.filename,
          title: t.title,
          text: t.text,
          language: t.language,
          duration: t.duration,
          maxWordsPerChunk: t.maxWordsPerChunk,
          status: t.status,
          error: t.error,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          videoExports: t.videoExports,
        })),
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
    } catch (error) {
      console.error("Error getting user transcriptions:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get transcriptions",
      });
    }
  }

  /**
   * Delete a transcription by ID
   */
  async deleteTranscription(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: "Transcription ID is required",
        });
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Check if transcription exists and belongs to user
      const existingTranscription = await prisma.transcription.findFirst({
        where: {
          id,
          userId: user.id,
        },
      });

      if (!existingTranscription) {
        return res.status(404).json({
          success: false,
          error: "Transcription not found",
        });
      }

      // Delete the transcription (this will cascade delete related rendered videos if configured)
      await prisma.transcription.delete({
        where: {
          id,
        },
      });

      res.status(200).json({
        success: true,
        message: "Transcription deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting transcription:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete transcription",
      });
    }
  }

  /**
   * Delete multiple transcriptions (bulk delete)
   */
  async deleteTranscriptions(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Transcription IDs array is required",
        });
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Delete transcriptions that belong to the user
      const result = await prisma.transcription.deleteMany({
        where: {
          id: {
            in: ids,
          },
          userId: user.id,
        },
      });

      res.status(200).json({
        success: true,
        count: result.count,
        message: `${result.count} transcription${
          result.count !== 1 ? "s" : ""
        } deleted successfully`,
      });
    } catch (error) {
      console.error("Error deleting transcriptions:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete transcriptions",
      });
    }
  }
}
