import {
  ELEVEN_V3_VOICE_PRESETS,
  type ElevenV3VoicePreset,
} from "../config/models/voice";
import { getSupabasePublicUrl } from "./supabase-storage";

export interface ElevenV3VoiceOption
  extends Omit<ElevenV3VoicePreset, "previewPath"> {
  /** Public URL of the ~30s sample clip (null when storage is unconfigured). */
  previewUrl: string | null;
}

/** Eleven v3 voice catalog with resolved preview URLs, ready for API responses. */
export function listElevenV3Voices(): ElevenV3VoiceOption[] {
  return ELEVEN_V3_VOICE_PRESETS.map(({ previewPath, ...voice }) => ({
    ...voice,
    previewUrl: getSupabasePublicUrl(previewPath),
  }));
}
