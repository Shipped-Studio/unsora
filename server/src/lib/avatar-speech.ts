const EMOTION_MOTION: Record<string, string> = {
  happy: "soft natural smile, warm but restrained",
  neutral: "calm conversational delivery, relaxed face",
  sad: "gentle sincere tone, subdued expression",
  angry: "focused intensity, controlled expression",
  surprised: "lightly engaged, not exaggerated",
  fearful: "cautious thoughtful delivery",
  excited: "mild enthusiasm, not over-animated",
};

const IDENTITY_MOTION = [
  "preserve exact facial identity from source photo",
  "lip and mouth movement only for speech",
  "minimal head movement",
  "stable eyes and eyebrows",
  "do not distort face shape or glasses",
  "static camera shot",
];

/** SkyReels prompt — identity first, then subtle mood. */
export function buildAvatarMotionPrompt(
  emotion: string,
  customPrompt?: string | null,
): string {
  const custom = customPrompt?.trim();
  if (custom) return custom;

  const mood = EMOTION_MOTION[emotion] ?? EMOTION_MOTION.neutral;

  return [...IDENTITY_MOTION, mood, "subtle natural blinking"].join(", ");
}

/** Insert short pauses so TTS (and lip-sync) breathe between phrases. */
export function formatTranscriptForAvatarTts(transcript: string): string {
  const trimmed = transcript.trim();
  if (!trimmed) return trimmed;

  return trimmed
    .replace(/\s*\n+\s*/g, '<break time="0.45s" /> ')
    .replace(/([.!?…])\s+/g, '$1<break time="0.35s" /> ')
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Rough estimate — ~150 wpm conversational. */
export function estimateSpeechSeconds(text: string): number {
  const words = text.replace(/\[[^\]]+\]/g, " ").split(/\s+/).filter(Boolean)
    .length;
  return Math.ceil((words / 2.5) * 10) / 10;
}

export const AVATAR_MAX_AUDIO_SECONDS = 20;
export const AVATAR_RECOMMENDED_SECONDS = 10;
