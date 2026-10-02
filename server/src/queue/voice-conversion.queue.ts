import { task } from "@trigger.dev/sdk";
import prisma from "../lib/db";
import { getElevenLabsClient, MAX_STS_AUDIO_SECONDS } from "../lib/elevenlabs-api";
import {
  cleanupTempFiles,
  downloadAudioToTemp,
  getAudioDurationSeconds,
} from "../lib/audio-mix";
import {
  isSupabaseStorageConfigured,
  uploadBufferToSupabase,
} from "../lib/supabase-storage";
import { STANDARD_RETRY, CANCELLED_ERROR } from "./task-utils";
import { createAsset } from "../lib/asset-utils";
import { refundConsumption } from "../lib/credits";

export interface VoiceConversionJobData {
  userId: string;
  conversionId: string;
  creditsUsed: number;
  creditTransactionId?: string;
  sourceUrl: string;
  elevenLabsVoiceId: string;
  outputFormat: string;
}

export interface VoiceConversionJobResult {
  success: boolean;
  conversionId: string;
  outputUrl?: string;
  error?: string;
}

export const voiceConversionTask = task({
  id: "voice-conversion",
  queue: { concurrencyLimit: 10 },
  retry: { ...STANDARD_RETRY, maxAttempts: 2 },
  run: async (
    payload: VoiceConversionJobData,
  ): Promise<VoiceConversionJobResult> => {
    const {
      userId,
      conversionId,
      sourceUrl,
      elevenLabsVoiceId,
      outputFormat,
    } = payload;

    const record = await prisma.voiceConversion.findUnique({
      where: { id: conversionId },
    });
    if (!record) throw new Error(`Record not found: ${conversionId}`);

    await prisma.voiceConversion.update({
      where: { id: conversionId },
      data: { status: "PROCESSING" },
    });

    const tempSource = await downloadAudioToTemp(
      sourceUrl,
      `voice-conv-src-${conversionId}.mp3`,
    );

    try {
      const duration = await getAudioDurationSeconds(tempSource);
      if (duration > MAX_STS_AUDIO_SECONDS) {
        throw new Error(
          `Audio must be at most ${MAX_STS_AUDIO_SECONDS / 60} minutes`,
        );
      }

      const sourceBuffer = await import("fs").then((fs) =>
        fs.readFileSync(tempSource),
      );

      const elevenLabs = getElevenLabsClient();
      const outputBuffer = await elevenLabs.speechToSpeech({
        voiceId: elevenLabsVoiceId,
        audioBuffer: sourceBuffer,
        audioFileName: `source-${conversionId}.mp3`,
        audioMimeType: "audio/mpeg",
        outputFormat: outputFormat === "wav" ? "wav" : "mp3",
      });

      if (!isSupabaseStorageConfigured()) {
        throw new Error("Storage is not configured");
      }

      const ext = outputFormat === "wav" ? "wav" : "mp3";
      const contentType = ext === "wav" ? "audio/wav" : "audio/mpeg";
      const outputUrl = await uploadBufferToSupabase(
        outputBuffer,
        `voice-conversions/voice-conv-${conversionId}.${ext}`,
        contentType,
      );

      const outputAsset = await createAsset({
        userId,
        url: outputUrl,
        name: `Voice conversion ${conversionId}`,
        type: "AUDIO",
        source: "GENERATION",
      });

      await prisma.voiceConversion.update({
        where: { id: conversionId },
        data: {
          status: "COMPLETED",
          outputAssetId: outputAsset.id,
        },
      });

      return { success: true, conversionId, outputUrl };
    } finally {
      cleanupTempFiles(tempSource);
    }
  },
  // Runs only after all retries are exhausted.
  onFailure: async ({ payload, error }) => {
    const message = error instanceof Error ? error.message : String(error);
    await finalizeConversion(payload, message, "voice.conversion.failed");
  },
  // Cancelled runs skip onFailure, so terminal cleanup must happen here too.
  onCancel: async ({ payload }) => {
    await finalizeConversion(payload, CANCELLED_ERROR, "voice.conversion.cancelled");
  },
});

// Shared terminal handler for onFailure/onCancel: mark the row and refund once.
async function finalizeConversion(
  payload: VoiceConversionJobData,
  message: string,
  refundReason: string,
) {
  const { conversionId, creditTransactionId } = payload;

  try {
    await prisma.voiceConversion.update({
      where: { id: conversionId },
      data: { status: "FAILED", error: message },
    });

    if (creditTransactionId) {
      await refundConsumption(creditTransactionId, refundReason, {
        conversionId,
      });
    }
  } catch (refundError) {
    console.error(
      `[VoiceConv ${conversionId}] Failed to update DB/refund:`,
      refundError,
    );
  }
}

export const addVoiceConversionJob = async (jobData: VoiceConversionJobData) => {
  const handle = await voiceConversionTask.trigger(jobData);
  return { id: handle.id };
};
