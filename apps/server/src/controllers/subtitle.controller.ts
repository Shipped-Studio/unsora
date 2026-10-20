import { Request, Response } from "express";
import { groupWordsIntoChunks } from "../lib/transcription";
import prisma from "../lib/db";
import {
  addSubtitleProcessingJob,
  getSubtitleQueueStats,
} from "../queue/subtitle.queue";
import { createAsset } from "../lib/asset-utils";
import { DURATION_TOLERANCE_SECONDS, measureMediaSeconds } from "../lib/media-limits";
import { generateObject } from "ai";
import { z } from "zod";
import { openrouter } from "../lib/ai-client";
import { hookTitlePrompt } from "../../prompts/hook-title.prompt";
import { normalizeCaptionLayout } from "../lib/caption-layout";
import { findCaptionKeywords } from "../lib/caption-keywords";
import {
  captionOptimizePrompt,
  captionTranslatePrompt,
} from "../../prompts/caption-edit.prompt";
import {
  InsufficientCreditsError,
  consumeCredits,
  refundConsumption,
} from "../lib/credits";
import {
  AI_IMAGE_CREDITS,
  PexelsNotConfiguredError,
  autoBrollCredits,
  generateBrollImage,
  planAutoBrolls,
  searchPexelsPhotos,
  searchPexelsVideos,
  type Orientation,
  type VideoType,
} from "../lib/broll";
import {
  AI_TOOL_CREDITS,
  VIDEO_TOOLS,
  findScenes,
  isAiTool,
  type ToolChunk,
} from "../lib/subtitle-tools";
import {
  setToolState,
  subtitleToolTask,
  type SubtitleToolJobData,
  type ToolState,
} from "../queue/subtitle-tools.queue";

/** The start of a transcript is plenty to write a hook from. */
const HOOK_TRANSCRIPT_CHARS = 4000;
const MAX_PREVIOUS_HOOKS = 10;

const MAX_SAVED_PRESETS = 50;
const MAX_PRESET_NAME = 40;
const MAX_PRESET_STYLE_CHARS = 12000;
const MAX_KEYWORD_WORDS = 6000;
const MAX_CAPTION_LINES = 2000;
const MAX_LINE_CHARS = 400;
// Lines sent to the AI per call when translating or fixing captions.
const LINES_PER_CALL = 80;
// Translate costs this many credits, as in Submagic.
const TRANSLATE_CREDITS = 1;

/** Runs `fix` on lines in batches and returns one result per line. */
async function inBatches<T>(
  lines: T[],
  fix: (batch: T[], offset: number) => Promise<Map<number, T>>,
): Promise<T[]> {
  const batches: number[] = [];
  for (let start = 0; start < lines.length; start += LINES_PER_CALL) batches.push(start);
  const results = await Promise.all(
    batches.map((start) => fix(lines.slice(start, start + LINES_PER_CALL), start)),
  );
  const merged = new Map<number, T>();
  for (const result of results) for (const [i, line] of result) merged.set(i, line);
  // A line the AI skipped stays as it was.
  return lines.map((line, i) => merged.get(i) ?? line);
}

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
      const { language, layout } = (req.body ?? {}) as {
        language?: string;
        layout?: unknown;
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
        layout: normalizeCaptionLayout(layout),
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
   * Write a hook title from the transcript. Words to style differently come
   * back wrapped in *asterisks*, and lines are separated by "\n".
   */
  /**
   * Marks keywords and emojis on the words the editor sends, so projects
   * transcribed before the keyword pass, or edited since, can get them.
   */
  async findKeywords(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;
      const { id } = req.params;
      const words: unknown = req.body?.words;
      if (
        !Array.isArray(words) ||
        words.length === 0 ||
        words.length > MAX_KEYWORD_WORDS ||
        !words.every((word) => typeof word === "string" && word.length <= 64)
      ) {
        return res.status(400).json({
          success: false,
          error: `Send between 1 and ${MAX_KEYWORD_WORDS} words.`,
        });
      }

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }
      const owned = await prisma.transcription.findFirst({
        where: { id, userId: user.id },
        select: { id: true },
      });
      if (!owned) {
        return res
          .status(404)
          .json({ success: false, error: "Transcription not found" });
      }

      const markup = await findCaptionKeywords(words as string[]);
      res.status(200).json({ success: true, data: markup });
    } catch (error) {
      console.error("Error finding caption keywords:", error);
      res.status(500).json({
        success: false,
        error: "Try again in a moment.",
      });
    }
  }

  /**
   * Runs one of the AI Tools. Credits are spent straight away, as in
   * Submagic; video passes run in the background and refund on failure.
   */
  async runAiTool(req: Request, res: Response) {
    const tool = req.params.tool;
    if (!isAiTool(tool)) {
      return res.status(404).json({ success: false, error: "Unknown tool" });
    }
    if (tool === "eye-contact") {
      return res.status(501).json({
        success: false,
        error: "Correct Eye Contact isn't available yet.",
      });
    }
    let transactionId: string | null = null;
    try {
      const owner = await this.ownedTranscription(req, res);
      if (!owner) return;
      const row = await prisma.transcription.findUnique({
        where: { id: owner.transcriptionId },
        select: { status: true, subtitleChunks: true, duration: true, metadata: true, videoAssetId: true },
      });
      if (!row?.videoAssetId || row.status !== "completed") {
        return res.status(400).json({
          success: false,
          error: "Transcribe the video first.",
        });
      }
      const aiTools = ((row.metadata as Record<string, unknown> | null)?.aiTools ?? {}) as Record<
        string,
        ToolState
      >;
      if (Object.values(aiTools).some((t) => t.status === "running")) {
        return res.status(409).json({
          success: false,
          error: "Another tool is still running. Try again when it's done.",
        });
      }

      const charge = await consumeCredits({
        userId: owner.userId,
        amount: AI_TOOL_CREDITS[tool],
        reason: `AI tool: ${tool}`,
        metadata: { transcriptionId: owner.transcriptionId, tool },
      });
      transactionId = charge.transactionId;

      if (tool === "auto-zooms") {
        const chunks = (
          typeof row.subtitleChunks === "string"
            ? JSON.parse(row.subtitleChunks)
            : (row.subtitleChunks ?? [])
        ) as ToolChunk[];
        const scenes = await findScenes(chunks, row.duration);
        await setToolState(owner.transcriptionId, tool, {
          status: "done",
          updatedAt: new Date().toISOString(),
        });
        return res.status(200).json({
          success: true,
          data: { scenes, creditsUsed: AI_TOOL_CREDITS[tool] },
        });
      }

      await setToolState(owner.transcriptionId, tool, {
        status: "running",
        updatedAt: new Date().toISOString(),
      });
      const payload: SubtitleToolJobData = {
        transcriptionId: owner.transcriptionId,
        tool: tool as SubtitleToolJobData["tool"],
        transactionId,
      };
      await subtitleToolTask.trigger(payload);
      res.status(202).json({
        success: true,
        data: { status: "running", creditsUsed: AI_TOOL_CREDITS[tool] },
      });
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        return res.status(402).json({
          success: false,
          error: `This tool needs ${AI_TOOL_CREDITS[tool]} credits.`,
        });
      }
      console.error(`Error running AI tool ${tool}:`, error);
      if (transactionId) {
        await refundConsumption(transactionId, `${tool} failed to start`).catch(
          (refundError) => console.error("Refund failed:", refundError),
        );
        await setToolState(req.params.id, tool, null).catch(() => {});
      }
      res.status(500).json({ success: false, error: "Try again in a moment." });
    }
  }

  /** Undoes a video pass by putting back the video and captions it replaced. */
  async removeAiTool(req: Request, res: Response) {
    const tool = req.params.tool;
    if (!isAiTool(tool)) {
      return res.status(404).json({ success: false, error: "Unknown tool" });
    }
    try {
      const owner = await this.ownedTranscription(req, res);
      if (!owner) return;
      const row = await prisma.transcription.findUnique({
        where: { id: owner.transcriptionId },
        select: { metadata: true },
      });
      const aiTools = ((row?.metadata as Record<string, unknown> | null)?.aiTools ?? {}) as Record<
        string,
        ToolState
      >;
      const state = aiTools[tool];
      if (!VIDEO_TOOLS.includes(tool) || !state?.snapshot) {
        await setToolState(owner.transcriptionId, tool, null);
        return res.status(200).json({ success: true, data: { restored: false } });
      }
      // Only the latest pass can be removed, or a later one would be lost too.
      const later = Object.entries(aiTools).some(
        ([other, s]) => other !== tool && s.snapshot && s.updatedAt > state.updatedAt,
      );
      if (later) {
        return res.status(409).json({
          success: false,
          error: "Remove the tools you ran after this one first.",
        });
      }
      const { snapshot } = state;
      await setToolState(owner.transcriptionId, tool, null, {
        videoAssetId: snapshot.videoAssetId,
        subtitleChunks: JSON.stringify(snapshot.subtitleChunks),
        segments: JSON.stringify(snapshot.segments),
        duration: snapshot.duration,
      });
      res.status(200).json({ success: true, data: { restored: true } });
    } catch (error) {
      console.error(`Error removing AI tool ${tool}:`, error);
      res.status(500).json({ success: false, error: "Try again in a moment." });
    }
  }

  /** Stock B-roll search: Pexels videos or photos. */
  async searchBroll(req: Request, res: Response) {
    const query = String(req.query.q ?? "").trim().slice(0, 100);
    const kind = req.query.type === "photo" ? "photo" : "video";
    const orientation = (["portrait", "landscape", "square"].includes(String(req.query.orientation))
      ? req.query.orientation
      : "portrait") as Orientation;
    if (!query) {
      return res.status(400).json({ success: false, error: "Type something to search for." });
    }
    try {
      // Premium and Trendy ask for sharper files than Free.
      const premium = req.query.tier === "premium" || req.query.tier === "trendy";
      const results =
        kind === "photo"
          ? await searchPexelsPhotos(query, orientation, 24)
          : await searchPexelsVideos(query, orientation, { perPage: 24, premium });
      res.status(200).json({ success: true, data: results });
    } catch (error) {
      if (error instanceof PexelsNotConfiguredError) {
        return res.status(503).json({
          success: false,
          error: "Stock footage isn't set up yet (PEXELS_API_KEY).",
        });
      }
      console.error("Error searching B-roll:", error);
      res.status(502).json({ success: false, error: "Search failed. Try again." });
    }
  }

  /** Makes one AI B-roll image. Costs credits; refunded if it fails. */
  async generateBroll(req: Request, res: Response) {
    const prompt = String(req.body?.prompt ?? "").trim().slice(0, 300);
    const orientation = (["portrait", "landscape", "square"].includes(req.body?.orientation)
      ? req.body.orientation
      : "portrait") as Orientation;
    if (!prompt) {
      return res.status(400).json({ success: false, error: "Describe the image." });
    }
    let transactionId: string | null = null;
    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: req.auth.userId },
        select: { id: true },
      });
      if (!user) return res.status(404).json({ success: false, error: "User not found" });
      const charge = await consumeCredits({
        userId: user.id,
        amount: AI_IMAGE_CREDITS,
        reason: "B-roll image",
      });
      transactionId = charge.transactionId;
      const media = await generateBrollImage(prompt, orientation);
      res.status(200).json({ success: true, data: { media, creditsUsed: AI_IMAGE_CREDITS } });
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        return res.status(402).json({
          success: false,
          error: `An AI image needs ${AI_IMAGE_CREDITS} credits.`,
        });
      }
      console.error("Error generating B-roll image:", error);
      if (transactionId) {
        await refundConsumption(transactionId, "B-roll image failed").catch(() => {});
      }
      res.status(500).json({ success: false, error: "Try again in a moment." });
    }
  }

  /**
   * Auto B-rolls: covers about the given percent of the video with footage
   * for its scenes. Stock is included; AI images cost credits each.
   */
  async autoBrolls(req: Request, res: Response) {
    const percent = Number(req.body?.percent);
    const videoType = (["free", "premium", "trendy"].includes(req.body?.videoType)
      ? req.body.videoType
      : "free") as VideoType;
    const orientation = (["portrait", "landscape", "square"].includes(req.body?.orientation)
      ? req.body.orientation
      : "portrait") as Orientation;
    const scenes: unknown = req.body?.scenes;
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return res.status(400).json({ success: false, error: "Percent must be 0 to 100." });
    }
    let transactionId: string | null = null;
    try {
      const owner = await this.ownedTranscription(req, res);
      if (!owner) return;
      const row = await prisma.transcription.findUnique({
        where: { id: owner.transcriptionId },
        select: { subtitleChunks: true, duration: true },
      });
      const chunks = (
        typeof row?.subtitleChunks === "string" ? JSON.parse(row.subtitleChunks) : (row?.subtitleChunks ?? [])
      ) as ToolChunk[];
      const sceneList =
        Array.isArray(scenes) && scenes.length
          ? (scenes as { start: number; end: number; brollQuery: string; keyword: string }[]).slice(0, 200)
          : await findScenes(chunks, row?.duration ?? 0);

      // Trendy makes an image per clip; charge for the most it could make.
      const maxClips = sceneList.length;
      const credits = autoBrollCredits(videoType, maxClips);
      if (credits > 0) {
        const charge = await consumeCredits({
          userId: owner.userId,
          amount: credits,
          reason: "Auto B-rolls (AI images)",
          metadata: { transcriptionId: owner.transcriptionId },
        });
        transactionId = charge.transactionId;
      }
      const plan = await planAutoBrolls({
        scenes: sceneList,
        duration: row?.duration ?? 0,
        percent,
        videoType,
        transitions: req.body?.transitions !== false,
        orientation,
      });
      // Refund the images that weren't needed.
      const used = autoBrollCredits(videoType, plan.clips.length);
      if (transactionId && used < credits) {
        await refundConsumption(transactionId, "Auto B-rolls: unused images");
        if (used > 0) {
          await consumeCredits({
            userId: owner.userId,
            amount: used,
            reason: "Auto B-rolls (AI images)",
            metadata: { transcriptionId: owner.transcriptionId },
          });
        }
      }
      res.status(200).json({
        success: true,
        data: { ...plan, scenes: sceneList, creditsUsed: used },
      });
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        return res.status(402).json({
          success: false,
          error: "You don't have enough credits for AI B-rolls.",
        });
      }
      if (error instanceof PexelsNotConfiguredError) {
        return res.status(503).json({
          success: false,
          error: "Stock footage isn't set up yet (PEXELS_API_KEY).",
        });
      }
      console.error("Error planning B-rolls:", error);
      if (transactionId) {
        await refundConsumption(transactionId, "Auto B-rolls failed").catch(() => {});
      }
      res.status(500).json({ success: false, error: "Try again in a moment." });
    }
  }

  /** Splits the video into AI scenes; free, as the B-rolls tab needs it. */
  async captionScenes(req: Request, res: Response) {
    try {
      const owner = await this.ownedTranscription(req, res);
      if (!owner) return;
      const row = await prisma.transcription.findUnique({
        where: { id: owner.transcriptionId },
        select: { subtitleChunks: true, duration: true },
      });
      const chunks = (
        typeof row?.subtitleChunks === "string" ? JSON.parse(row.subtitleChunks) : (row?.subtitleChunks ?? [])
      ) as ToolChunk[];
      const scenes = await findScenes(chunks, row?.duration ?? 0);
      res.status(200).json({ success: true, data: { scenes } });
    } catch (error) {
      console.error("Error finding scenes:", error);
      res.status(500).json({ success: false, error: "Try again in a moment." });
    }
  }

  /** Names the project from its transcript, as Submagic's "AI title". */
  async projectTitle(req: Request, res: Response) {
    try {
      const owner = await this.ownedTranscription(req, res);
      if (!owner) return;
      const row = await prisma.transcription.findUnique({
        where: { id: owner.transcriptionId },
        select: { text: true },
      });
      if (!row?.text.trim()) {
        return res.status(400).json({ success: false, error: "Transcribe the video first." });
      }
      const { object } = await generateObject({
        model: openrouter("openai/gpt-4o-mini"),
        schema: z.object({ title: z.string() }),
        prompt: `Write a short, specific title (3 to 7 words) for a project folder holding this video, in the transcript's language. No quotes, no emoji, no full stop.\n\nTranscript:\n"""\n${row.text.slice(0, 3000)}\n"""`,
      });
      const title = object.title.replace(/^["'“”]+|["'“”.]+$/g, "").trim().slice(0, 120);
      if (!title) {
        return res.status(502).json({ success: false, error: "The AI came back empty. Try again." });
      }
      await prisma.transcription.update({ where: { id: owner.transcriptionId }, data: { title } });
      res.status(200).json({ success: true, data: { title } });
    } catch (error) {
      console.error("Error writing project title:", error);
      res.status(500).json({ success: false, error: "Try again in a moment." });
    }
  }

  /** Owns-the-project check shared by the caption AI endpoints. */
  private async ownedTranscription(req: Request, res: Response) {
    const user = await prisma.user.findUnique({
      where: { clerkId: req.auth.userId },
      select: { id: true },
    });
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return null;
    }
    const owned = await prisma.transcription.findFirst({
      where: { id: req.params.id, userId: user.id },
      select: { id: true },
    });
    if (!owned) {
      res.status(404).json({ success: false, error: "Transcription not found" });
      return null;
    }
    return { userId: user.id, transcriptionId: owned.id };
  }

  /** Translates caption lines. Costs credits; refunded if it fails. */
  async translateCaptions(req: Request, res: Response) {
    const language: unknown = req.body?.language;
    const lines: unknown = req.body?.lines;
    if (
      typeof language !== "string" ||
      !language.trim() ||
      language.length > 40 ||
      !Array.isArray(lines) ||
      lines.length === 0 ||
      lines.length > MAX_CAPTION_LINES ||
      !lines.every((l) => typeof l === "string" && l.length <= MAX_LINE_CHARS)
    ) {
      return res.status(400).json({
        success: false,
        error: "Send a language and the caption lines to translate.",
      });
    }
    let transactionId: string | null = null;
    try {
      const owner = await this.ownedTranscription(req, res);
      if (!owner) return;
      const charge = await consumeCredits({
        userId: owner.userId,
        amount: TRANSLATE_CREDITS,
        reason: "Translate captions",
        metadata: { transcriptionId: owner.transcriptionId, language },
      });
      transactionId = charge.transactionId;

      const translated = await inBatches(lines as string[], async (batch, offset) => {
        const { object } = await generateObject({
          model: openrouter("openai/gpt-4o-mini"),
          schema: z.object({
            lines: z.array(z.object({ index: z.number().int(), text: z.string() })),
          }),
          prompt: captionTranslatePrompt(
            language,
            batch.map((line, i) => `${offset + i}: ${line}`).join("\n"),
          ),
        });
        return new Map(
          object.lines
            .filter((l) => l.index >= offset && l.index < offset + batch.length && l.text.trim())
            .map((l) => [l.index, l.text.trim().slice(0, MAX_LINE_CHARS)]),
        );
      });

      res.status(200).json({
        success: true,
        data: { lines: translated, creditsUsed: TRANSLATE_CREDITS },
      });
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        return res.status(402).json({
          success: false,
          error: "You don't have enough credits to translate.",
        });
      }
      console.error("Error translating captions:", error);
      if (transactionId) {
        await refundConsumption(transactionId, "Translate captions failed").catch(
          (refundError) => console.error("Refund failed:", refundError),
        );
      }
      res.status(500).json({ success: false, error: "Try again in a moment." });
    }
  }

  /** Fixes speech recognition mistakes in the caption lines' words. */
  async optimizeCaptions(req: Request, res: Response) {
    const lines: unknown = req.body?.lines;
    if (
      !Array.isArray(lines) ||
      lines.length === 0 ||
      lines.length > MAX_CAPTION_LINES ||
      !lines.every(
        (line) =>
          Array.isArray(line) &&
          line.length <= 40 &&
          line.every((w) => typeof w === "string" && w.length <= 64),
      )
    ) {
      return res.status(400).json({
        success: false,
        error: "Send the caption lines as lists of words.",
      });
    }
    try {
      const owner = await this.ownedTranscription(req, res);
      if (!owner) return;
      const fixed = await inBatches(lines as string[][], async (batch, offset) => {
        const { object } = await generateObject({
          model: openrouter("openai/gpt-4o-mini"),
          schema: z.object({
            lines: z.array(
              z.object({ index: z.number().int(), words: z.array(z.string()) }),
            ),
          }),
          prompt: captionOptimizePrompt(
            batch.map((words, i) => `${offset + i}: ${words.join(" ")}`).join("\n"),
          ),
        });
        return new Map(
          object.lines
            .filter(
              (l) =>
                l.index >= offset &&
                l.index < offset + batch.length &&
                l.words.length > 0 &&
                l.words.length <= 40,
            )
            .map((l) => [l.index, l.words.map((w) => w.trim().slice(0, 64)).filter(Boolean)]),
        );
      });
      res.status(200).json({ success: true, data: { lines: fixed } });
    } catch (error) {
      console.error("Error optimizing captions:", error);
      res.status(500).json({ success: false, error: "Try again in a moment." });
    }
  }

  async generateHookTitle(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;
      const { id } = req.params;
      const previousHooks: string[] = Array.isArray(req.body?.previousHooks)
        ? req.body.previousHooks
            .filter((hook: unknown): hook is string => typeof hook === "string")
            .slice(0, MAX_PREVIOUS_HOOKS)
        : [];

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const transcription = await prisma.transcription.findFirst({
        where: { id, userId: user.id },
        select: { text: true },
      });
      if (!transcription) {
        return res
          .status(404)
          .json({ success: false, error: "Transcription not found" });
      }
      if (!transcription.text.trim()) {
        return res.status(400).json({
          success: false,
          error: "Transcribe the video first.",
        });
      }

      const { object } = await generateObject({
        model: openrouter("openai/gpt-4o-mini"),
        schema: z.object({ hook: z.string() }),
        prompt: hookTitlePrompt(
          transcription.text.slice(0, HOOK_TRANSCRIPT_CHARS),
          previousHooks,
        ),
      });

      const hook = object.hook
        .replace(/\\n/g, "\n")
        .split("\n")
        .map((line) => line.trim().replace(/^["'“”]+|["'“”.]+$/g, ""))
        .filter(Boolean)
        .slice(0, 2)
        .join("\n")
        .slice(0, 120);

      if (!hook) {
        return res.status(502).json({
          success: false,
          error: "The AI came back empty. Try again.",
        });
      }

      res.status(200).json({ success: true, data: { hook } });
    } catch (error) {
      console.error("Error generating hook title:", error);
      res.status(500).json({
        success: false,
        error: "Try again in a moment.",
      });
    }
  }

  /** Caption styles the user saved, newest first. */
  async listPresets(req: Request, res: Response) {
    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: req.auth.userId },
        select: { id: true },
      });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const presets = await prisma.subtitlePreset.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, style: true },
      });
      res.status(200).json({ success: true, data: presets });
    } catch (error) {
      console.error("Error listing subtitle presets:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to load saved presets" });
    }
  }

  async createPreset(req: Request, res: Response) {
    try {
      const name =
        typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const style = req.body?.style;
      if (!name || name.length > MAX_PRESET_NAME) {
        return res.status(400).json({
          success: false,
          error: `Give the preset a name of up to ${MAX_PRESET_NAME} characters.`,
        });
      }
      if (
        !style ||
        typeof style !== "object" ||
        Array.isArray(style) ||
        JSON.stringify(style).length > MAX_PRESET_STYLE_CHARS
      ) {
        return res
          .status(400)
          .json({ success: false, error: "The preset's style is invalid." });
      }

      const user = await prisma.user.findUnique({
        where: { clerkId: req.auth.userId },
        select: { id: true },
      });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const count = await prisma.subtitlePreset.count({
        where: { userId: user.id },
      });
      if (count >= MAX_SAVED_PRESETS) {
        return res.status(400).json({
          success: false,
          error: `You can save up to ${MAX_SAVED_PRESETS} presets. Delete one first.`,
        });
      }

      const preset = await prisma.subtitlePreset.create({
        data: { userId: user.id, name, style },
        select: { id: true, name: true, style: true },
      });
      res.status(201).json({ success: true, data: preset });
    } catch (error) {
      console.error("Error saving subtitle preset:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to save the preset" });
    }
  }

  async deletePreset(req: Request, res: Response) {
    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: req.auth.userId },
        select: { id: true },
      });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const { count } = await prisma.subtitlePreset.deleteMany({
        where: { id: req.params.presetId, userId: user.id },
      });
      if (count === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Preset not found" });
      }
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error deleting subtitle preset:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to delete the preset" });
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
