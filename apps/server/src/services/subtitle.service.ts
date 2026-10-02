import prisma from "../lib/db";
import { createAsset } from "../lib/asset-utils";

// Transcription operations
export const createTranscription = async (data: {
  userId: string;
  videoUrl: string;
  maxWordsPerChunk: number;
}) => {
  const videoAsset = await createAsset({
    userId: data.userId,
    url: data.videoUrl,
    name: "Transcription source video",
    type: "VIDEO",
    source: "UPLOAD",
  });

  return await prisma.transcription.create({
    data: {
      userId: data.userId,
      videoAssetId: videoAsset.id,
      text: "",
      language: "unknown",
      duration: 0,
      width: 1920,
      height: 1080,
      segments: "[]",
      subtitleChunks: "[]",
      maxWordsPerChunk: data.maxWordsPerChunk,
      status: "processing",
    },
  });
};

export const updateTranscriptionStatus = async (id: string, status: string) => {
  return await prisma.transcription.update({
    where: { id },
    data: { status },
  });
};

export const updateTranscriptionData = async (
  id: string,
  data: {
    text: string;
    language: string;
    duration: number;
    segments: any[];
    subtitleChunks: any[];
    maxWordsPerChunk: number;
    width?: number;
    height?: number;
  }
) => {
  return await prisma.transcription.update({
    where: { id },
    data: {
      text: data.text,
      language: data.language,
      duration: data.duration,
      segments: JSON.stringify(data.segments),
      subtitleChunks: JSON.stringify(data.subtitleChunks),
      maxWordsPerChunk: data.maxWordsPerChunk,
      ...(data.width != null && { width: data.width }),
      ...(data.height != null && { height: data.height }),
    },
  });
};

export const updateTranscriptionError = async (id: string, error: string) => {
  return await prisma.transcription.update({
    where: { id },
    data: {
      status: "failed",
      error,
    },
  });
};

export const createVideoExport = async (data: {
  userId: string;
  transcriptionId: string;
  sourceUrl: string;
  outputUrl: string;
  settings: any;
  duration: number;
  fps: number;
  width: number;
  height: number;
}) => {
  const sourceAsset = await createAsset({
    userId: data.userId,
    url: data.sourceUrl,
    name: "Export source video",
    type: "VIDEO",
    width: data.width,
    height: data.height,
    duration: data.duration,
    source: "EXPORT",
  });

  const outputAsset = await createAsset({
    userId: data.userId,
    url: data.outputUrl,
    name: "Exported video",
    type: "VIDEO",
    width: data.width,
    height: data.height,
    duration: data.duration,
    source: "EXPORT",
  });

  return await prisma.videoExport.create({
    data: {
      userId: data.userId,
      transcriptionId: data.transcriptionId,
      sourceAssetId: sourceAsset.id,
      outputAssetId: outputAsset.id,
      settings: data.settings,
      duration: data.duration,
      fps: data.fps,
      width: data.width,
      height: data.height,
      status: "completed",
    },
  });
};
