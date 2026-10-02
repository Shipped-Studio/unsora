import { task } from "@trigger.dev/sdk";
import { WavespeedAPI, getWavespeedClient } from "../lib/wavespeed-api";
import { getElevenLabsClient } from "../lib/elevenlabs-api";
import prisma from "../lib/db";
import { uploadUrlToStorage } from "../lib/upload";
import {
  isSupabaseStorageConfigured,
  uploadBufferToSupabase,
} from "../lib/supabase-storage";
import {
  cleanupTempFiles,
  downloadAudioToTemp,
  mixAudioTracks,
} from "../lib/audio-mix";
import path from "path";
import { STANDARD_RETRY, CANCELLED_ERROR } from "./task-utils";
import { createAsset } from "../lib/asset-utils";
import { refundConsumption } from "../lib/credits";
import { formatTrackLabel } from "../lib/music-track-utils";

export interface MusicGenerationJobData {
  userId: string;
  generationId: string;
  creditsUsed: number;
  /** Credit transaction id to refund on failure. */
  creditTransactionId?: string;
  lyrics: string;
  prompt: string;
  modelKey: string;
  endpoint: string;
  kind: "song" | "bgm";
  outputFormat: string;
  voiceCloneMode?: boolean;
  elevenLabsVoiceId?: string;
  vocalText?: string;
  bgmEndpoint?: string;
  trackNumber?: number;
  songTitle?: string;
}

export interface MusicGenerationJobResult {
  success: boolean;
  generationId: string;
  outputUrl?: string;
  error?: string;
}

async function generateBgmUrl(
  client: ReturnType<typeof getWavespeedClient>,
  generationId: string,
  payload: MusicGenerationJobData,
): Promise<string> {
  const bgmEndpoint =
    payload.bgmEndpoint ?? "mureka-ai/mureka-v7.5/generate-bgm";
  const stylePrompt = [
    payload.prompt.trim(),
    "instrumental only, no vocals, backing track",
  ]
    .filter(Boolean)
    .join(", ");

  const { model, input } = WavespeedAPI.murekaMusicInput({
    endpoint: bgmEndpoint,
    kind: "bgm",
    lyrics: payload.lyrics,
    prompt: stylePrompt || payload.lyrics,
    outputFormat: "mp3",
  });

  const taskId = await client.submit(model, input);
  await prisma.musicGeneration.update({
    where: { id: generationId },
    data: { taskId },
  });

  const result = await client.poll(taskId);
  if (result.status === "failed") {
    throw new Error(result.error || "BGM generation failed");
  }

  const providerAudioUrl = result.outputs[0];
  if (!providerAudioUrl) {
    throw new Error("No BGM URL returned from provider");
  }

  const uploadResult = await uploadUrlToStorage(
    providerAudioUrl,
    `music-bgm-${generationId}.mp3`,
    "music-generations",
  );

  return uploadResult.success && uploadResult.fileUrl
    ? uploadResult.fileUrl
    : providerAudioUrl;
}

export const musicGenerationTask = task({
  id: "music-generation",
  queue: { concurrencyLimit: 10 },
  retry: { ...STANDARD_RETRY, maxAttempts: 2 },
  run: async (
    payload: MusicGenerationJobData,
  ): Promise<MusicGenerationJobResult> => {
    const {
      userId,
      generationId,
      lyrics,
      prompt,
      endpoint,
      kind,
      outputFormat,
      voiceCloneMode,
      elevenLabsVoiceId,
      vocalText,
    } = payload;

    const trackLabel = payload.trackNumber
      ? formatTrackLabel(payload.trackNumber)
      : "Track";
    const songTitle = payload.songTitle?.trim();

    const client = getWavespeedClient();

    const record = await prisma.musicGeneration.findUnique({
      where: { id: generationId },
    });
    if (!record) throw new Error(`Record not found: ${generationId}`);

    await prisma.musicGeneration.update({
      where: { id: generationId },
      data: { status: "PROCESSING" },
    });

    let outputUrl: string;

    if (voiceCloneMode && elevenLabsVoiceId && vocalText) {
      const bgmUrl = await generateBgmUrl(client, generationId, payload);

      const elevenLabs = getElevenLabsClient();
      const vocalBuffer = await elevenLabs.textToSpeech({
        voiceId: elevenLabsVoiceId,
        text: vocalText,
        outputFormat: "mp3",
        musicOverlay: true,
      });

      if (!isSupabaseStorageConfigured()) {
        throw new Error("Storage is not configured");
      }

      const vocalUrl = await uploadBufferToSupabase(
        vocalBuffer,
        `music-generations/music-vocal-${generationId}.mp3`,
        "audio/mpeg",
      );

      const bgmPath = await downloadAudioToTemp(
        bgmUrl,
        `music-bgm-${generationId}.mp3`,
      );
      const vocalPath = await downloadAudioToTemp(
        vocalUrl,
        `music-vocal-${generationId}.mp3`,
      );
      const mixedPath = path.join(
        process.cwd(),
        "temp",
        `music-mixed-${generationId}.mp3`,
      );

      try {
        await mixAudioTracks(bgmPath, vocalPath, mixedPath);

        const mixedBuffer = await import("fs").then((fs) =>
          fs.readFileSync(mixedPath),
        );
        outputUrl = await uploadBufferToSupabase(
          mixedBuffer,
          `music-generations/music-${generationId}.mp3`,
          "audio/mpeg",
        );
      } finally {
        cleanupTempFiles(bgmPath, vocalPath, mixedPath);
      }
    } else {
      let taskId = record.taskId;

      if (!taskId) {
        const { model, input } = WavespeedAPI.murekaMusicInput({
          endpoint,
          kind,
          lyrics,
          prompt,
          outputFormat,
        });

        taskId = await client.submit(model, input);

        await prisma.musicGeneration.update({
          where: { id: generationId },
          data: { taskId },
        });
      }

      const result = await client.poll(taskId);

      if (result.status === "failed") {
        throw new Error(result.error || "Music generation failed");
      }

      const providerAudioUrl = result.outputs[0];
      if (!providerAudioUrl) {
        throw new Error("No audio URL returned from provider");
      }

      const ext =
        outputFormat === "wav" ? "wav" : outputFormat === "flac" ? "flac" : "mp3";
      const uploadResult = await uploadUrlToStorage(
        providerAudioUrl,
        `music-${generationId}.${ext}`,
        "music-generations",
      );

      outputUrl =
        uploadResult.success && uploadResult.fileUrl
          ? uploadResult.fileUrl
          : providerAudioUrl;
    }

    const outputAsset = await createAsset({
      userId,
      url: outputUrl,
      name: songTitle ? `${trackLabel} — ${songTitle}` : `${trackLabel} — Music generation`,
      type: "AUDIO",
      source: "GENERATION",
    });

    await prisma.musicGeneration.update({
      where: { id: generationId },
      data: {
        status: "COMPLETED",
        outputAssetId: outputAsset.id,
      },
    });

    return { success: true, generationId, outputUrl };
  },
  // Runs only after all retries are exhausted.
  onFailure: async ({ payload, error }) => {
    const message = error instanceof Error ? error.message : String(error);
    await finalizeGeneration(payload, message, "music.generation.failed");
  },
  // Cancelled runs skip onFailure, so terminal cleanup must happen here too.
  onCancel: async ({ payload }) => {
    await finalizeGeneration(payload, CANCELLED_ERROR, "music.generation.cancelled");
  },
});

// Shared terminal handler for onFailure/onCancel: mark the row and refund once.
async function finalizeGeneration(
  payload: MusicGenerationJobData,
  message: string,
  refundReason: string,
) {
  const { generationId, creditTransactionId } = payload;

  try {
    await prisma.musicGeneration.update({
      where: { id: generationId },
      data: { status: "FAILED", error: message },
    });

    if (creditTransactionId) {
      await refundConsumption(creditTransactionId, refundReason, {
        generationId,
      });
    }
  } catch (refundError) {
    console.error(
      `[MusicGen ${generationId}] Failed to update DB/refund:`,
      refundError,
    );
  }
}

export const addMusicGenerationJob = async (
  jobData: MusicGenerationJobData,
  options?: { priority?: number; delay?: number },
) => {
  const handle = await musicGenerationTask.trigger(jobData, {
    delay: options?.delay ? new Date(Date.now() + options.delay) : undefined,
  });
  return { id: handle.id };
};
