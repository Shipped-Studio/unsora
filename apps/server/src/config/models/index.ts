export type {
  ModelCategory,
  Provider,
  VideoModelConfig,
  ImageModelConfig,
  MotionControlModelConfig,
  VideoUpscaleModelConfig,
  ImageUpscaleConfig,
  InfluencerConfig,
  MovieMaterialsConfig,
  MusicModelConfig,
  AvatarModelConfig,
  VoiceModelConfig,
  ModelConfig,
} from "./types";
export { tierCredits } from "./types";

// ─── Video Models ───

import klingV3Standard from "./kling-v3-standard";
import klingV3Pro from "./kling-v3-pro";
import veo31 from "./veo-3.1";
import veo31Fast from "./veo-3.1-fast";
import veo31Lite from "./veo-3.1-lite";
import sora2 from "./sora-2";
import sora2Pro from "./sora-2-pro";
import wan26 from "./wan-2.6";
import seedance20 from "./seedance-2.0";
import seedance20Fast from "./seedance-2.0-fast";
import seedance20Mini from "./seedance-2.0-mini";
import geminiOmniFlash from "./gemini-omni-flash";

export {
  klingV3Standard,
  klingV3Pro,
  veo31,
  veo31Fast,
  veo31Lite,
  sora2,
  sora2Pro,
  wan26,
  seedance20,
  seedance20Fast,
  seedance20Mini,
  geminiOmniFlash,
};

// ─── Image Models ───

import nanoBananaPro from "./nano-banana-pro";
import nanoBanana2 from "./nano-banana-2";
import seedreamV5Lite from "./seedream-v5-lite";
import gptImage15 from "./gpt-image-1.5";
import gptImage2 from "./gpt-image-2";

export { nanoBananaPro, nanoBanana2, seedreamV5Lite, gptImage15, gptImage2 };

// ─── Motion Control Models ───

import klingMc26Pro from "./kling-mc-2.6-pro";
import klingMc30Pro from "./kling-mc-3.0-pro";
import klingMc30Std from "./kling-mc-3.0-std";

export { klingMc26Pro, klingMc30Pro, klingMc30Std };

// ─── Video Upscale Models ───

import {
  videoUpscaleStandard,
  videoUpscaleUltra1080p,
  videoUpscaleUltra4k,
} from "./video-upscaler";

export { videoUpscaleStandard, videoUpscaleUltra1080p, videoUpscaleUltra4k };

// ─── Feature Configs ───

export { imageUpscaleConfig } from "./image-upscaler";
export { influencerConfig } from "./influencer";
export { movieMaterialsConfig } from "./movie-materials";
export {
  MUSIC_MODELS,
  DEFAULT_MUSIC_MODEL_KEY,
} from "./mureka";
export {
  AVATAR_MODELS,
  DEFAULT_AVATAR_MODEL_KEY,
} from "./avatar";
export {
  VOICE_MODELS,
  DEFAULT_VOICE_MODEL_KEY,
  CLONED_VOICE_MODEL_KEY,
  ELEVEN_V3_MODEL_KEY,
  VOICE_PRESETS,
  ELEVEN_V3_VOICE_PRESETS,
  VOICE_EMOTIONS,
  VOICE_CLONE_CREDIT_COST,
  MAX_VOICE_CLONES_PER_USER,
} from "./voice";

// ─── Registries ───

import type {
  VideoModelConfig,
  ImageModelConfig,
  MotionControlModelConfig,
  VideoUpscaleModelConfig,
} from "./types";

export const VIDEO_MODELS: Record<string, VideoModelConfig> = {
  [klingV3Standard.key]: klingV3Standard,
  [klingV3Pro.key]: klingV3Pro,
  [veo31.key]: veo31,
  [veo31Fast.key]: veo31Fast,
  [veo31Lite.key]: veo31Lite,
  [sora2.key]: sora2,
  [sora2Pro.key]: sora2Pro,
  [wan26.key]: wan26,
  [seedance20.key]: seedance20,
  [seedance20Fast.key]: seedance20Fast,
  [seedance20Mini.key]: seedance20Mini,
  [geminiOmniFlash.key]: geminiOmniFlash,
};

export const IMAGE_MODELS: Record<string, ImageModelConfig> = {
  [nanoBananaPro.key]: nanoBananaPro,
  [nanoBanana2.key]: nanoBanana2,
  [seedreamV5Lite.key]: seedreamV5Lite,
  [gptImage15.key]: gptImage15,
  [gptImage2.key]: gptImage2,
};

export const MOTION_CONTROL_MODELS: Record<string, MotionControlModelConfig> = {
  [klingMc26Pro.key]: klingMc26Pro,
  [klingMc30Pro.key]: klingMc30Pro,
  [klingMc30Std.key]: klingMc30Std,
};

export const VIDEO_UPSCALE_MODELS: Record<string, VideoUpscaleModelConfig> = {
  [videoUpscaleStandard.key]: videoUpscaleStandard,
  [videoUpscaleUltra1080p.key]: videoUpscaleUltra1080p,
  [videoUpscaleUltra4k.key]: videoUpscaleUltra4k,
};
