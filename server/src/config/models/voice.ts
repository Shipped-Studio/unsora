import type { VoiceModelConfig } from "./types";

const minimaxSpeech26Hd: VoiceModelConfig = {
  key: "minimax-speech-2.6-hd",
  displayName: "MiniMax Speech 2.6 HD",
  category: "voice",
  provider: "wavespeed",
  dbModel: "minimax-speech-2.6-hd",
  endpoint: "minimax/speech-2.6-hd",
  // NOT repriced — vendor cost unknown, so this stays at 1 credit / 1,000 chars.
  credits: ({ charCount }) => Math.max(1, Math.ceil(charCount / 1000)),
};

const elevenLabsMultilingual: VoiceModelConfig = {
  key: "elevenlabs-multilingual-v2",
  displayName: "ElevenLabs Multilingual v2",
  category: "voice",
  provider: "elevenlabs",
  dbModel: "elevenlabs-multilingual-v2",
  endpoint: "",
  // $0.00008/char × 500 = $0.04 per block → 50% target margin = 3 credits
  // per started 500-char block.
  credits: ({ charCount }) => Math.max(3, Math.ceil(charCount / 500) * 3),
};

const elevenV3: VoiceModelConfig = {
  key: "eleven-v3",
  displayName: "ElevenLabs Eleven v3",
  category: "voice",
  provider: "wavespeed",
  dbModel: "elevenlabs-eleven-v3",
  endpoint: "elevenlabs/eleven-v3",
  // WaveSpeed bills $0.10 per started 1,000-char block → 50% target margin
  // = $0.20 revenue per block → 6 credits per started 1,000-char block.
  credits: ({ charCount }) => Math.max(6, Math.ceil(charCount / 1000) * 6),
};

export const VOICE_MODELS: Record<string, VoiceModelConfig> = {
  [minimaxSpeech26Hd.key]: minimaxSpeech26Hd,
  [elevenLabsMultilingual.key]: elevenLabsMultilingual,
  [elevenV3.key]: elevenV3,
};

export const DEFAULT_VOICE_MODEL_KEY = "minimax-speech-2.6-hd";
export const CLONED_VOICE_MODEL_KEY = "elevenlabs-multilingual-v2";
export const ELEVEN_V3_MODEL_KEY = "eleven-v3";

/**
 * Credits charged once when creating an instant voice clone.
 * NOT repriced — vendor cost unknown, so this stays at its old value.
 */
export const VOICE_CLONE_CREDIT_COST = 15;

/** Max cloned voices per user. */
export const MAX_VOICE_CLONES_PER_USER = 10;

/** Built-in MiniMax voice presets exposed in the UI. */
export const VOICE_PRESETS = [
  { id: "Friendly_Person", label: "Friendly Person" },
  { id: "Wise_Woman", label: "Wise Woman" },
  { id: "Deep_Voice_Man", label: "Deep Voice Man" },
  { id: "Calm_Woman", label: "Calm Woman" },
  { id: "Casual_Guy", label: "Casual Guy" },
  { id: "Lively_Girl", label: "Lively Girl" },
  { id: "Inspirational_girl", label: "Inspirational Girl" },
  { id: "Determined_Man", label: "Determined Man" },
  { id: "Lovely_Girl", label: "Lovely Girl" },
  { id: "Elegant_Man", label: "Elegant Man" },
  { id: "English_CaptivatingStoryteller", label: "Captivating Storyteller" },
  { id: "English_ConfidentWoman", label: "Confident Woman" },
] as const;

export interface ElevenV3VoicePreset {
  id: string;
  label: string;
  description: string;
  gender: "male" | "female" | "neutral";
  accent: string;
  /** Object key of the preview clip inside the Supabase storage bucket. */
  previewPath: string;
}

/**
 * ElevenLabs Eleven v3 voices exposed through WaveSpeed (`voice_id` values).
 * Preview clips live in Supabase storage under voice-previews/eleven-v3/ —
 * re-sync them with server/scripts/sync-voice-previews.ts.
 */
export const ELEVEN_V3_VOICE_PRESETS: ElevenV3VoicePreset[] = [
  { id: "Aria", label: "Aria", description: "Expressive, husky female voice for social media and storytelling", gender: "female", accent: "american", previewPath: "voice-previews/eleven-v3/Aria.mp3" },
  { id: "Roger", label: "Roger", description: "Laid-back, resonant male voice for casual conversations", gender: "male", accent: "american", previewPath: "voice-previews/eleven-v3/Roger.mp3" },
  { id: "Sarah", label: "Sarah", description: "Confident, warm young female voice with a professional tone", gender: "female", accent: "american", previewPath: "voice-previews/eleven-v3/Sarah.mp3" },
  { id: "Laura", label: "Laura", description: "Sunny, quirky young female voice for social media", gender: "female", accent: "american", previewPath: "voice-previews/eleven-v3/Laura.mp3" },
  { id: "Charlie", label: "Charlie", description: "Confident, energetic young male voice", gender: "male", accent: "australian", previewPath: "voice-previews/eleven-v3/Charlie.mp3" },
  { id: "George", label: "George", description: "Warm, mature male narrator for storytelling", gender: "male", accent: "british", previewPath: "voice-previews/eleven-v3/George.mp3" },
  { id: "Callum", label: "Callum", description: "Gravelly male voice with an intense edge for characters", gender: "male", accent: "american", previewPath: "voice-previews/eleven-v3/Callum.mp3" },
  { id: "River", label: "River", description: "Relaxed, neutral voice for narration and conversation", gender: "neutral", accent: "american", previewPath: "voice-previews/eleven-v3/River.mp3" },
  { id: "Liam", label: "Liam", description: "Energetic, warm young male voice for reels and shorts", gender: "male", accent: "american", previewPath: "voice-previews/eleven-v3/Liam.mp3" },
  { id: "Charlotte", label: "Charlotte", description: "Smooth, alluring female voice for characters and narration", gender: "female", accent: "swedish", previewPath: "voice-previews/eleven-v3/Charlotte.mp3" },
  { id: "Alice", label: "Alice", description: "Clear, friendly professional female voice for e-learning", gender: "female", accent: "british", previewPath: "voice-previews/eleven-v3/Alice.mp3" },
  { id: "Matilda", label: "Matilda", description: "Upbeat professional female voice with a pleasing alto pitch", gender: "female", accent: "american", previewPath: "voice-previews/eleven-v3/Matilda.mp3" },
  { id: "Will", label: "Will", description: "Chill, conversational young male voice", gender: "male", accent: "american", previewPath: "voice-previews/eleven-v3/Will.mp3" },
  { id: "Jessica", label: "Jessica", description: "Playful, trendy young female voice", gender: "female", accent: "american", previewPath: "voice-previews/eleven-v3/Jessica.mp3" },
  { id: "Eric", label: "Eric", description: "Smooth classy male tenor, great for agents and support", gender: "male", accent: "american", previewPath: "voice-previews/eleven-v3/Eric.mp3" },
  { id: "Chris", label: "Chris", description: "Natural, down-to-earth male voice for everyday content", gender: "male", accent: "american", previewPath: "voice-previews/eleven-v3/Chris.mp3" },
  { id: "Brian", label: "Brian", description: "Resonant, comforting male voice for narrations and ads", gender: "male", accent: "american", previewPath: "voice-previews/eleven-v3/Brian.mp3" },
  { id: "Daniel", label: "Daniel", description: "Strong, formal male voice for broadcasts and news", gender: "male", accent: "british", previewPath: "voice-previews/eleven-v3/Daniel.mp3" },
  { id: "Lily", label: "Lily", description: "Velvety, confident female voice for news and narration", gender: "female", accent: "british", previewPath: "voice-previews/eleven-v3/Lily.mp3" },
  { id: "Bill", label: "Bill", description: "Friendly, crisp older male voice for storytelling and ads", gender: "male", accent: "american", previewPath: "voice-previews/eleven-v3/Bill.mp3" },
];

export const VOICE_EMOTIONS = [
  "happy",
  "sad",
  "angry",
  "fearful",
  "disgusted",
  "surprised",
  "neutral",
] as const;
