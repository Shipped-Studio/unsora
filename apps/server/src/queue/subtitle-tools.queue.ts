import { task } from "@trigger.dev/sdk";
import fs from "fs";
import path from "path";
import prisma from "../lib/db";
import { downloadVideo } from "../lib/audio";
import { uploadLocalFileToStorage } from "../lib/upload";
import { createVideoAssetWithProbe } from "../lib/asset-utils";
import { refundConsumption } from "../lib/credits";
import {
  cleanAudio,
  cutVideo,
  findBadTakes,
  invertRanges,
  keepRangesWithoutSilence,
  retimeChunks,
  type AiTool,
  type Range,
  type ToolChunk,
} from "../lib/subtitle-tools";

export interface SubtitleToolJobData {
  transcriptionId: string;
  tool: Extract<AiTool, "clean-audio" | "remove-silence" | "remove-bad-takes">;
  /** The credit charge, refunded if the job fails. */
  transactionId: string;
}

/** What a tool changed, kept so Remove can put it back. */
export interface ToolSnapshot {
  videoAssetId: string | null;
  subtitleChunks: unknown;
  segments: unknown;
  duration: number;
}

export interface ToolState {
  status: "running" | "done" | "failed";
  updatedAt: string;
  error?: string;
  /** Set when the tool changed nothing, e.g. no pauses to cut. */
  note?: string;
  snapshot?: ToolSnapshot;
}

// Less than this much to cut isn't worth a new video.
const MIN_CUT_SECONDS = 0.3;

const parse = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== "string") return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

/** Sets one tool's state in the transcription's metadata. */
export async function setToolState(
  transcriptionId: string,
  tool: AiTool,
  state: ToolState | null,
  extra: Record<string, unknown> = {},
) {
  const row = await prisma.transcription.findUnique({
    where: { id: transcriptionId },
    select: { metadata: true },
  });
  const metadata = parse<Record<string, unknown>>(row?.metadata, {}) ?? {};
  const aiTools = { ...(metadata.aiTools as Record<string, ToolState> | undefined) };
  if (state) aiTools[tool] = state;
  else delete aiTools[tool];
  await prisma.transcription.update({
    where: { id: transcriptionId },
    data: { metadata: { ...metadata, aiTools } as object, ...extra },
  });
}

export const subtitleToolTask = task({
  id: "subtitle-ai-tool",
  queue: { concurrencyLimit: 5 },
  // One attempt: a failure refunds the credits, which a retry would repeat.
  retry: { maxAttempts: 1 },
  run: async (payload: SubtitleToolJobData) => {
    const { transcriptionId, tool } = payload;
    const row = await prisma.transcription.findUnique({
      where: { id: transcriptionId },
      include: { videoAsset: true },
    });
    if (!row?.videoAsset) throw new Error("Transcription or video not found");

    const chunks = parse<ToolChunk[]>(row.subtitleChunks, []);
    const segments = parse<ToolChunk[]>(row.segments, []);
    const snapshot: ToolSnapshot = {
      videoAssetId: row.videoAssetId,
      subtitleChunks: chunks,
      segments,
      duration: row.duration,
    };

    const tempDir = path.join(process.cwd(), "temp");
    fs.mkdirSync(tempDir, { recursive: true });
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const input = path.join(tempDir, `tool_in_${id}.mp4`);
    const output = path.join(tempDir, `tool_out_${id}.mp4`);

    try {
      let keep: Range[] | null = null;
      if (tool === "remove-silence") {
        keep = keepRangesWithoutSilence(chunks.flatMap((c) => c.words), row.duration);
      } else if (tool === "remove-bad-takes") {
        keep = invertRanges(await findBadTakes(chunks, row.duration), row.duration);
      }
      const kept = keep?.reduce((n, [a, b]) => n + (b - a), 0) ?? row.duration;
      if (keep && row.duration - kept < MIN_CUT_SECONDS) {
        await setToolState(transcriptionId, tool, {
          status: "done",
          updatedAt: new Date().toISOString(),
          note:
            tool === "remove-silence"
              ? "No pauses long enough to cut."
              : "No bad takes found.",
        });
        return { changed: false };
      }

      await downloadVideo(row.videoAsset.url, input);
      if (tool === "clean-audio") await cleanAudio(input, output);
      else await cutVideo(input, output, keep!);

      const uploaded = await uploadLocalFileToStorage(output, `${tool}.mp4`);
      if (!uploaded.success || !uploaded.fileUrl) {
        throw new Error(uploaded.error ?? "Upload failed");
      }
      const asset = await createVideoAssetWithProbe({
        userId: row.userId,
        url: uploaded.fileUrl,
        name: `${row.videoAsset.name} (${tool})`,
      });

      await setToolState(
        transcriptionId,
        tool,
        { status: "done", updatedAt: new Date().toISOString(), snapshot },
        {
          videoAssetId: asset.id,
          ...(keep
            ? {
                subtitleChunks: JSON.stringify(retimeChunks(chunks, keep)),
                segments: JSON.stringify(retimeChunks(segments, keep)),
                duration: kept,
              }
            : {}),
        },
      );
      return { changed: true };
    } catch (error) {
      console.error(`[Subtitle tool ${tool}] failed:`, error);
      await setToolState(transcriptionId, tool, {
        status: "failed",
        updatedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Failed",
      });
      await refundConsumption(payload.transactionId, `${tool} failed`).catch((refundError) =>
        console.error("Refund failed:", refundError),
      );
      throw error;
    } finally {
      for (const file of [input, output]) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    }
  },
});
