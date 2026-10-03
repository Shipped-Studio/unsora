export type ModelCategory =
  | "video"
  | "image"
  | "motion-control"
  | "video-upscale"
  | "music"
  | "avatar"
  | "voice";
export type Provider = "wavespeed" | "seedance" | "elevenlabs";

export interface VideoModelConfig {
  key: string;
  displayName: string;
  category: "video";
  provider: Provider;
  dbModel: string;
  endpoints?: {
    textToVideo?: string;
    imageToVideo?: string;
    referenceToVideo?: string;
    videoExtend?: string;
    startEndToVideo?: string;
  };
  supportsSound: boolean;
  supportsNegativePrompt: boolean;
  durationRange: [min: number, max: number];
  /** Exact durations (seconds) the model accepts — overrides durationRange. */
  durations?: number[];
  aspectRatio?: string[];
  /** Selectable output resolutions (e.g. Wan/Veo 720p/1080p). */
  resolution?: string[];
  maxFiles?: {
    images?: number;
    videos?: number;
    audio?: number;
  };
  /** Fixed output resolution when the provider ties quality to the model variant (e.g. Seedance 2.0 vs Fast). */
  outputResolution?: string;
  credits: (params: {
    duration: number;
    sound?: boolean;
    resolution?: string;
  }) => number;
}

export interface ImageModelConfig {
  key: string;
  displayName: string;
  category: "image";
  provider: Provider;
  dbModel: string;
  resolution: string[];
  aspectRatio?: string[];
  maxRefs?: number;
  endpoints?: {
    textToImage?: string;
    imageToImage?: string;
    referenceToImage?: string;
  };
  credits: (params: { resolution?: string; size?: string }) => number;
}

export interface MotionControlModelConfig {
  key: string;
  displayName: string;
  category: "motion-control";
  provider: Provider;
  dbModel: string;
  validResolutions: string[];
  validOrientations: string[];
  durationRange: [min: number, max: number];
  credits: (params: { duration: number; resolution: string }) => number;
}

export interface VideoUpscaleModelConfig {
  key: string;
  displayName: string;
  category: "video-upscale";
  credits: (params: { duration: number }) => number;
}

export interface ImageUpscaleConfig {
  validResolutions: string[];
  credits: Record<string, number>;
}

export interface InfluencerConfig {
  validRatios: string[];
  cameraAngles: string[];
  styleModes: string[];
  /** Subject age in years — inclusive bounds. */
  minAge: number;
  maxAge: number;
  maxCount: number;
}

export interface MovieMaterialsConfig {
  validModes: string[];
  validRatios: string[];
  validResolutions: string[];
  maxReferenceImages: number;
}

export interface MusicModelConfig {
  key: string;
  displayName: string;
  category: "music";
  provider: Provider;
  dbModel: string;
  endpoint: string;
  /** `song` uses lyrics + prompt; `bgm` is instrumental background music. */
  kind: "song" | "bgm";
  credits: () => number;
}

export interface AvatarModelConfig {
  key: string;
  displayName: string;
  category: "avatar";
  provider: Provider;
  dbModel: string;
  endpoint: string;
  validResolutions: string[];
  credits: () => number;
}

export interface VoiceModelConfig {
  key: string;
  displayName: string;
  category: "voice";
  provider: Provider;
  dbModel: string;
  endpoint: string;
  /** Credits per 1,000 characters (minimum 1 credit). */
  credits: (params: { charCount: number }) => number;
}

export type ModelConfig =
  | VideoModelConfig
  | ImageModelConfig
  | MotionControlModelConfig
  | VideoUpscaleModelConfig
  | MusicModelConfig
  | AvatarModelConfig
  | VoiceModelConfig;

/**
 * Resolve a credit cost from a sorted list of [maxDuration, credits] tiers.
 * Falls back to the last tier if duration exceeds all thresholds.
 */
export function tierCredits(
  tiers: [maxDuration: number, credits: number][],
  duration: number,
): number {
  for (const [maxDur, cost] of tiers) {
    if (duration <= maxDur) return cost;
  }
  return tiers[tiers.length - 1][1];
}
