import prisma from "./db";
import {
  DEFAULT_VOICE_MODEL_KEY,
  ELEVEN_V3_MODEL_KEY,
  ELEVEN_V3_VOICE_PRESETS,
  VOICE_PRESETS,
} from "../config/models";

export type VoiceSource = "preset" | "clone";

export interface ResolvedVoice {
  source: VoiceSource;
  /** Stored on VoiceGeneration.voiceId — preset id or VoiceClone.id */
  voiceId: string;
  /** Provider preset id (MiniMax or Eleven v3) when source is preset */
  presetVoiceId?: string;
  /** Voice model key the preset belongs to (minimax vs eleven-v3) */
  presetModelKey?: string;
  /** ElevenLabs voice id when source is clone */
  elevenLabsVoiceId?: string;
}

export async function resolveVoiceForUser(
  userId: string,
  voiceId: string,
): Promise<ResolvedVoice | null> {
  const clone = await prisma.voiceClone.findFirst({
    where: { id: voiceId, userId },
    select: { id: true, elevenLabsVoiceId: true },
  });

  if (clone) {
    return {
      source: "clone",
      voiceId: clone.id,
      elevenLabsVoiceId: clone.elevenLabsVoiceId,
    };
  }

  if (VOICE_PRESETS.some((v) => v.id === voiceId)) {
    return {
      source: "preset",
      voiceId,
      presetVoiceId: voiceId,
      presetModelKey: DEFAULT_VOICE_MODEL_KEY,
    };
  }

  if (ELEVEN_V3_VOICE_PRESETS.some((v) => v.id === voiceId)) {
    return {
      source: "preset",
      voiceId,
      presetVoiceId: voiceId,
      presetModelKey: ELEVEN_V3_MODEL_KEY,
    };
  }

  return null;
}

/** Resolve a voice clone id only (for STS / music vocal overlay). */
export async function resolveVoiceCloneForUser(
  userId: string,
  voiceId: string,
): Promise<ResolvedVoice | null> {
  const resolved = await resolveVoiceForUser(userId, voiceId);
  if (!resolved || resolved.source !== "clone") return null;
  return resolved;
}
