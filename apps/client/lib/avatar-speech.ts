/** Rough estimate — ~150 wpm conversational. */
export function estimateSpeechSeconds(text: string): number {
  const words = text
    .replace(/\[[^\]]+\]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.ceil((words / 2.5) * 10) / 10;
}

export const AVATAR_RECOMMENDED_SECONDS = 10;
export const AVATAR_MAX_AUDIO_SECONDS = 20;

export const AVATAR_PHOTO_TIPS = [
  "Crop to face and shoulders — keep hands out of frame",
  "Face the camera directly with a neutral or soft smile",
  "Plain background and even lighting work best",
  "Glasses and busy scenes often look stiff — simpler photos look more natural",
] as const;
