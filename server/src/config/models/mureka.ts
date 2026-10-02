import type { MusicModelConfig } from "./types";

const murekaV9: MusicModelConfig = {
  key: "auto",
  displayName: "Mureka V9 (Auto)",
  category: "music",
  provider: "wavespeed",
  dbModel: "mureka-v9",
  endpoint: "mureka-ai/mureka-v9/generate-song",
  kind: "song",
  // $0.04/job → 50% target margin.
  credits: () => 3,
};

const murekaV9Explicit: MusicModelConfig = {
  key: "mureka-9",
  displayName: "Mureka V9",
  category: "music",
  provider: "wavespeed",
  dbModel: "mureka-v9",
  endpoint: "mureka-ai/mureka-v9/generate-song",
  kind: "song",
  // $0.04/job → 50% target margin.
  credits: () => 3,
};

const murekaV8: MusicModelConfig = {
  key: "mureka-8",
  displayName: "Mureka V8",
  category: "music",
  provider: "wavespeed",
  dbModel: "mureka-v8",
  endpoint: "mureka-ai/mureka-v8/generate-song",
  kind: "song",
  // $0.04/job → 50% target margin.
  credits: () => 3,
};

const murekaO2: MusicModelConfig = {
  key: "mureka-o2",
  displayName: "Mureka O2",
  category: "music",
  provider: "wavespeed",
  dbModel: "mureka-o2",
  endpoint: "mureka-ai/mureka-o2/generate-song",
  kind: "song",
  // NOT repriced — vendor cost unknown, so the repricing left this at its old value.
  credits: () => 6,
};

const murekaV76: MusicModelConfig = {
  key: "mureka-7.6",
  displayName: "Mureka V7.6",
  category: "music",
  provider: "wavespeed",
  dbModel: "mureka-v7.6",
  endpoint: "mureka-ai/mureka-v7.6/generate-song",
  kind: "song",
  // NOT repriced — vendor cost unknown, so the repricing left this at its old value.
  credits: () => 4,
};

const murekaV75: MusicModelConfig = {
  key: "mureka-7.5",
  displayName: "Mureka V7.5 (BGM)",
  category: "music",
  provider: "wavespeed",
  dbModel: "mureka-v7.5",
  endpoint: "mureka-ai/mureka-v7.5/generate-bgm",
  kind: "bgm",
  // NOT repriced — vendor cost unknown, so the repricing left this at its old value.
  credits: () => 4,
};

export const MUSIC_MODELS: Record<string, MusicModelConfig> = {
  [murekaV9.key]: murekaV9,
  [murekaV9Explicit.key]: murekaV9Explicit,
  [murekaV8.key]: murekaV8,
  [murekaO2.key]: murekaO2,
  [murekaV76.key]: murekaV76,
  [murekaV75.key]: murekaV75,
};

export const DEFAULT_MUSIC_MODEL_KEY = "auto";
