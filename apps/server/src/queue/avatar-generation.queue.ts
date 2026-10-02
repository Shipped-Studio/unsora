import { task } from "@trigger.dev/sdk";
import { WavespeedAPI, getWavespeedClient } from "../lib/wavespeed-api";
import { getElevenLabsClient } from "../lib/elevenlabs-api";
import prisma from "../lib/db";
import { uploadUrlToStorage } from "../lib/upload";
import {
  isSupabaseStorageConfigured,
  uploadBufferToSupabase,
} from "../lib/supabase-storage";
import { STANDARD_RETRY, CANCELLED_ERROR } from "./task-utils";
import { createAsset } from "../lib/asset-utils";
import { refundConsumption } from "../lib/credits";
import { resolveAvatarTtsEndpoint } from "./voice-generation.queue";
import {
  buildAvatarMotionPrompt,
  formatTranscriptForAvatarTts,
} from "../lib/avatar-speech";
import type { VoiceSource } from "../lib/voice-resolver";

export interface AvatarGenerationJobData {
  userId: string;
  generationId: string;
  creditsUsed: number;
  creditTransactionId?: string;
  transcript: string;
  emotion: string;
  prompt: string;
  resolution: string;
  voiceId: string;
  voiceSource: VoiceSource;
  presetVoiceId?: string;
  elevenLabsVoiceId?: string;
  speed?: number;
  modelKey: string;
  endpoint: string;
  imageUrl: string;
  /** When set, skip TTS and use this audio URL directly. */
  audioUrl?: string;
}

export interface AvatarGenerationJobResult {
  success: boolean;
  generationId: string;
  outputUrl?: string;
  error?: string;
}

async function resolveAudioUrl(
  client: ReturnType<typeof getWavespeedClient>,
  generationId: string,
  data: AvatarGenerationJobData,
): Promise<string> {
  if (data.audioUrl) return data.audioUrl;

  const record = await prisma.avatarGeneration.findUnique({
    where: { id: generationId },
    include: { audioAsset: true },
  });
  if (!record) throw new Error(`Record not found: ${generationId}`);

  if (record.audioAsset?.url) {
    return record.audioAsset.url;
  }

  let ttsTaskId = record.ttsTaskId;

  if (!ttsTaskId) {
    if (data.voiceSource === "clone") {
      if (!data.elevenLabsVoiceId) {
        throw new Error("Missing ElevenLabs voice id for cloned voice");
      }

      const elevenLabs = getElevenLabsClient();
      const avatarText = formatTranscriptForAvatarTts(data.transcript);
      const audioBuffer = await elevenLabs.textToSpeech({
        voiceId: data.elevenLabsVoiceId,
        text: avatarText,
        speed: data.speed ?? 0.96,
        outputFormat: "mp3",
        avatarDelivery: true,
      });

      if (!isSupabaseStorageConfigured()) {
        throw new Error("Storage is not configured for avatar TTS output");
      }

      const audioUrl = await uploadBufferToSupabase(
        audioBuffer,
        `avatar-generations/avatar-tts-${generationId}.mp3`,
        "audio/mpeg",
      );

      const audioAsset = await createAsset({
        userId: data.userId,
        url: audioUrl,
        name: `Avatar TTS ${generationId}`,
        type: "AUDIO",
        source: "GENERATION",
      });

      await prisma.avatarGeneration.update({
        where: { id: generationId },
        data: { audioAssetId: audioAsset.id },
      });

      return audioUrl;
    }

    const ttsEndpoint = resolveAvatarTtsEndpoint();
    const avatarText = formatTranscriptForAvatarTts(data.transcript);
    const { model, input } = WavespeedAPI.voiceTtsInput({
      endpoint: ttsEndpoint,
      text: avatarText,
      voiceId: data.presetVoiceId ?? data.voiceId,
      emotion: data.emotion,
      speed: data.speed ?? 0.96,
      outputFormat: "mp3",
    });

    ttsTaskId = await client.submit(model, input);

    await prisma.avatarGeneration.update({
      where: { id: generationId },
      data: { ttsTaskId },
    });
  }

  const ttsResult = await client.poll(ttsTaskId);

  if (ttsResult.status === "failed") {
    throw new Error(ttsResult.error || "Speech synthesis failed");
  }

  const providerAudioUrl = ttsResult.outputs[0];
  if (!providerAudioUrl) {
    throw new Error("No audio URL returned from TTS");
  }

  const uploadResult = await uploadUrlToStorage(
    providerAudioUrl,
    `avatar-tts-${generationId}.mp3`,
    "avatar-generations",
  );

  const audioUrl =
    uploadResult.success && uploadResult.fileUrl
      ? uploadResult.fileUrl
      : providerAudioUrl;

  const audioAsset = await createAsset({
    userId: data.userId,
    url: audioUrl,
    name: `Avatar TTS ${generationId}`,
    type: "AUDIO",
    source: "GENERATION",
  });

  await prisma.avatarGeneration.update({
    where: { id: generationId },
    data: { audioAssetId: audioAsset.id },
  });

  return audioUrl;
}

export const avatarGenerationTask = task({
  id: "avatar-generation",
  queue: { concurrencyLimit: 10 },
  retry: { ...STANDARD_RETRY, maxAttempts: 2 },
  run: async (
    payload: AvatarGenerationJobData,
  ): Promise<AvatarGenerationJobResult> => {
    const {
      userId,
      generationId,
      transcript,
      emotion,
      prompt,
      resolution,
      voiceId,
      endpoint,
      imageUrl,
      audioUrl: providedAudioUrl,
    } = payload;

    const client = getWavespeedClient();

    const record = await prisma.avatarGeneration.findUnique({
      where: { id: generationId },
    });
    if (!record) throw new Error(`Record not found: ${generationId}`);

    await prisma.avatarGeneration.update({
      where: { id: generationId },
      data: { status: "PROCESSING" },
    });

    const audioUrl = await resolveAudioUrl(client, generationId, {
      ...payload,
      audioUrl: providedAudioUrl,
    });

    let taskId = record.taskId;

    if (!taskId) {
      const stylePrompt = buildAvatarMotionPrompt(emotion, prompt);

      const { model, input } = WavespeedAPI.avatarTalkingInput({
        endpoint,
        image: imageUrl,
        audio: audioUrl,
        prompt: stylePrompt,
        resolution,
      });

      taskId = await client.submit(model, input);

      await prisma.avatarGeneration.update({
        where: { id: generationId },
        data: { taskId },
      });
    }

    const result = await client.poll(taskId);

    if (result.status === "failed") {
      throw new Error(result.error || "Avatar generation failed");
    }

    const providerVideoUrl = result.outputs[0];
    if (!providerVideoUrl) {
      throw new Error("No video URL returned from provider");
    }

    const uploadResult = await uploadUrlToStorage(
      providerVideoUrl,
      `avatar-${generationId}.mp4`,
      "avatar-generations",
    );

    const outputUrl =
      uploadResult.success && uploadResult.fileUrl
        ? uploadResult.fileUrl
        : providerVideoUrl;

    const outputAsset = await createAsset({
      userId,
      url: outputUrl,
      name: `Avatar generation ${generationId}`,
      type: "VIDEO",
      source: "GENERATION",
    });

    await prisma.avatarGeneration.update({
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
    await finalizeGeneration(payload, message, "avatar.generation.failed");
  },
  // Cancelled runs skip onFailure, so terminal cleanup must happen here too.
  onCancel: async ({ payload }) => {
    await finalizeGeneration(payload, CANCELLED_ERROR, "avatar.generation.cancelled");
  },
});

// Shared terminal handler for onFailure/onCancel: mark the row and refund once.
async function finalizeGeneration(
  payload: AvatarGenerationJobData,
  message: string,
  refundReason: string,
) {
  const { generationId, creditTransactionId } = payload;

  try {
    await prisma.avatarGeneration.update({
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
      `[AvatarGen ${generationId}] Failed to update DB/refund:`,
      refundError,
    );
  }
}

export const addAvatarGenerationJob = async (
  jobData: AvatarGenerationJobData,
  options?: { priority?: number; delay?: number },
) => {
  const handle = await avatarGenerationTask.trigger(jobData, {
    delay: options?.delay ? new Date(Date.now() + options.delay) : undefined,
  });
  return { id: handle.id };
};
