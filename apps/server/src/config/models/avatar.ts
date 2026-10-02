import type { AvatarModelConfig } from "./types";

const skyreelsV3: AvatarModelConfig = {
  key: "skyreels-v3",
  displayName: "SkyReels V3 Talking Avatar",
  category: "avatar",
  provider: "wavespeed",
  dbModel: "skyreels-v3",
  endpoint: "wavespeed-ai/skyreels-v3/talking-avatar",
  validResolutions: ["480p", "720p"],
  credits: () => 10,
};

export const AVATAR_MODELS: Record<string, AvatarModelConfig> = {
  [skyreelsV3.key]: skyreelsV3,
};

export const DEFAULT_AVATAR_MODEL_KEY = "skyreels-v3";
