import prisma from "./db";
import type { AssetType, AssetSource } from "@prisma/client";
import { Input, FilePathSource, MP4 } from "mediabunny";
import fs from "fs";
import path from "path";
import axios from "axios";

interface CreateAssetInput {
  userId: string;
  url: string;
  name: string;
  mimeType?: string;
  type: AssetType;
  source?: AssetSource;
  fileSize?: bigint;
  width?: number;
  height?: number;
  duration?: number;
}

export async function createAsset(input: CreateAssetInput) {
  const existing = await prisma.asset.findFirst({
    where: { userId: input.userId, url: input.url },
  });
  if (existing) return existing;

  return prisma.asset.create({
    data: {
      userId: input.userId,
      url: input.url,
      name: input.name,
      mimeType: input.mimeType || guessMimeType(input.url, input.type),
      type: input.type,
      source: input.source ?? "SYSTEM",
      fileSize: input.fileSize ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      duration: input.duration ?? null,
    },
  });
}

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  fileSize: bigint;
}

/**
 * Download a video URL to a temp file, probe it with mediabunny for
 * width / height / duration, then clean up. Returns null on failure
 * so callers can fall back gracefully.
 */
export async function probeVideoMetadata(
  videoUrl: string,
): Promise<VideoMetadata | null> {
  const tempDir = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tempPath = path.join(tempDir, `probe_${suffix}.mp4`);

  try {
    const res = await axios({
      url: videoUrl,
      method: "GET",
      responseType: "stream",
      timeout: 120_000,
    });

    await new Promise<void>((resolve, reject) => {
      const ws = fs.createWriteStream(tempPath);
      res.data.pipe(ws);
      ws.on("finish", resolve);
      ws.on("error", reject);
    });

    const stats = fs.statSync(tempPath);
    if (stats.size === 0) return null;

    const input = new Input({
      formats: [MP4],
      source: new FilePathSource(tempPath),
    });

    const track = await input.getPrimaryVideoTrack();
    let width = 0;
    let height = 0;
    let duration = 0;

    if (track) {
      width = track.displayWidth;
      height = track.displayHeight;
      duration = await track.computeDuration();
    }

    input.dispose();

    return {
      width,
      height,
      duration: Math.round(duration * 100) / 100,
      fileSize: BigInt(stats.size),
    };
  } catch (err) {
    console.warn("[probeVideoMetadata] Failed to probe video:", err);
    return null;
  } finally {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {
      // non-critical cleanup
    }
  }
}

/**
 * Create an Asset record and optionally probe a video URL for metadata.
 * Falls back to a plain createAsset if probing fails.
 */
export async function createVideoAssetWithProbe(
  input: Omit<CreateAssetInput, "type"> & { type?: AssetType },
): Promise<ReturnType<typeof createAsset>> {
  const meta = await probeVideoMetadata(input.url);

  return createAsset({
    ...input,
    type: input.type ?? "VIDEO",
    width: input.width ?? meta?.width,
    height: input.height ?? meta?.height,
    duration: input.duration ?? meta?.duration,
    fileSize: input.fileSize ?? meta?.fileSize,
  });
}

function guessMimeType(url: string, type: AssetType): string {
  if (type === "VIDEO") return "video/mp4";
  if (type === "AUDIO") return "audio/mpeg";
  const lower = url.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
