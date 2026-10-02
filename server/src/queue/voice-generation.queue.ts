import { task } from "@trigger.dev/sdk";
import { WavespeedAPI, getWavespeedClient } from "../lib/wavespeed-api";
import { getElevenLabsClient } from "../lib/elevenlabs-api";
import prisma from "../lib/db";
import { uploadUrlToStorage } from "../lib/upload";
import { uploadBufferToSupabase, isSupabaseStorageConfigured } from "../lib/supabase-storage";
import { STANDARD_RETRY, CANCELLED_ERROR } from "./task-utils";
import { createAsset } from "../lib/asset-utils";
import { refundConsumption } from "../lib/credits";
import {
  DEFAULT_VOICE_MODEL_KEY,
  ELEVEN_V3_MODEL_KEY,
  VOICE_MODELS,
} from "../config/models";
import type { VoiceSource } from "../lib/voice-resolver";

export interface VoiceGenerationJobData {
  userId: string;
  generationId: string;
  creditsUsed: number;
  creditTransactionId?: string;
  text: string;
  voiceId: string;
  voiceSource: VoiceSource;
  presetVoiceId?: string;
  elevenLabsVoiceId?: string;
  emotion: string;
  speed: number;
  /** Eleven v3 only — voice stability (0–1). */
  stability?: number;
  /** Eleven v3 only — similarity to the base voice (0–1). */
  similarity?: number;
  modelKey: string;
  endpoint: string;
  outputFormat: string;
}

export interface VoiceGenerationJobResult {
  success: boolean;
  generationId: string;
  outputUrl?: string;
  error?: string;
}

async function uploadElevenLabsAudio(
  audioBuffer: Buffer,
  generationId: string,
  outputFormat: string,
): Promise<string> {
  const ext =
    outputFormat === "wav" ? "wav" : outputFormat === "flac" ? "flac" : "mp3";
  const contentType =
    ext === "wav"
      ? "audio/wav"
      : ext === "flac"
        ? "audio/flac"
        : "audio/mpeg";
  const fileName = `voice-generations/voice-${generationId}.${ext}`;

  if (!isSupabaseStorageConfigured()) {
    throw new Error("Storage is not configured for ElevenLabs output");
  }

  return uploadBufferToSupabase(audioBuffer, fileName, contentType);
}

export const voiceGenerationTask = task({
  id: "voice-generation",
  queue: { concurrencyLimit: 10 },
  retry: { ...STANDARD_RETRY, maxAttempts: 2 },
  run: async (
    payload: VoiceGenerationJobData,
  ): Promise<VoiceGenerationJobResult> => {
    const {
      userId,
      generationId,
      text,
      voiceSource,
      presetVoiceId,
      elevenLabsVoiceId,
      emotion,
      speed,
      endpoint,
      outputFormat,
    } = payload;

    const record = await prisma.voiceGeneration.findUnique({
      where: { id: generationId },
    });
    if (!record) throw new Error(`Record not found: ${generationId}`);

    await prisma.voiceGeneration.update({
      where: { id: generationId },
      data: { status: "PROCESSING" },
    });

    let outputUrl: string;

    if (voiceSource === "clone") {
      if (!elevenLabsVoiceId) {
        throw new Error("Missing ElevenLabs voice id for cloned voice");
      }

      const elevenLabs = getElevenLabsClient();
      const audioBuffer = await elevenLabs.textToSpeech({
        voiceId: elevenLabsVoiceId,
        text,
        speed,
        outputFormat: outputFormat === "wav" ? "wav" : "mp3",
      });

      outputUrl = await uploadElevenLabsAudio(
        audioBuffer,
        generationId,
        outputFormat,
      );
    } else {
      const client = getWavespeedClient();
      let taskId = record.taskId;

      if (!taskId) {
        const { model, input } =
          payload.modelKey === ELEVEN_V3_MODEL_KEY
            ? WavespeedAPI.elevenV3TtsInput({
                endpoint,
                text,
                voiceId: presetVoiceId ?? payload.voiceId,
                stability: payload.stability,
                similarity: payload.similarity,
              })
            : WavespeedAPI.voiceTtsInput({
                endpoint,
                text,
                voiceId: presetVoiceId ?? payload.voiceId,
                emotion,
                speed,
                outputFormat,
              });

        taskId = await client.submit(model, input);

        await prisma.voiceGeneration.update({
          where: { id: generationId },
          data: { taskId },
        });
      }

      const result = await client.poll(taskId);

      if (result.status === "failed") {
        throw new Error(result.error || "Voice generation failed");
      }

      const providerAudioUrl = result.outputs[0];
      if (!providerAudioUrl) {
        throw new Error("No audio URL returned from provider");
      }

      const ext =
        outputFormat === "wav"
          ? "wav"
          : outputFormat === "flac"
            ? "flac"
            : "mp3";
      const uploadResult = await uploadUrlToStorage(
        providerAudioUrl,
        `voice-${generationId}.${ext}`,
        "voice-generations",
      );

      outputUrl =
        uploadResult.success && uploadResult.fileUrl
          ? uploadResult.fileUrl
          : providerAudioUrl;
    }

    const outputAsset = await createAsset({
      userId,
      url: outputUrl,
      name: `Voice generation ${generationId}`,
      type: "AUDIO",
      source: "GENERATION",
    });

    await prisma.voiceGeneration.update({
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
    await finalizeGeneration(payload, message, "voice.generation.failed");
  },
  // Cancelled runs skip onFailure, so terminal cleanup must happen here too.
  onCancel: async ({ payload }) => {
    await finalizeGeneration(payload, CANCELLED_ERROR, "voice.generation.cancelled");
  },
});

// Shared terminal handler for onFailure/onCancel: mark the row and refund once.
async function finalizeGeneration(
  payload: VoiceGenerationJobData,
  message: string,
  refundReason: string,
) {
  const { generationId, creditTransactionId } = payload;

  try {
    await prisma.voiceGeneration.update({
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
      `[VoiceGen ${generationId}] Failed to update DB/refund:`,
      refundError,
    );
  }
}

export const addVoiceGenerationJob = async (
  jobData: VoiceGenerationJobData,
  options?: { priority?: number; delay?: number },
) => {
  const handle = await voiceGenerationTask.trigger(jobData, {
    delay: options?.delay ? new Date(Date.now() + options.delay) : undefined,
  });
  return { id: handle.id };
};

/** Resolve default TTS endpoint for avatar pipeline (transcript → audio). */
export function resolveAvatarTtsEndpoint(modelKey?: string): string {
  const key = modelKey ?? DEFAULT_VOICE_MODEL_KEY;
  return VOICE_MODELS[key]?.endpoint ?? VOICE_MODELS[DEFAULT_VOICE_MODEL_KEY].endpoint;
}
