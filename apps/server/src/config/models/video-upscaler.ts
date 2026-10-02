import { VideoUpscaleModelConfig, tierCredits } from "./types";

export const videoUpscaleStandard: VideoUpscaleModelConfig = {
  key: "standard",
  displayName: "Video Upscaler Standard",
  category: "video-upscale",
  // Held at 10 credits — deliberately unchanged by the repricing.
  credits: () => 10,
};

export const videoUpscaleUltra1080p: VideoUpscaleModelConfig = {
  key: "ultra-1080p",
  displayName: "Video Upscaler Ultra 1080p",
  category: "video-upscale",
  // $0.02/s → 50% target margin.
  credits: ({ duration }) => {
    return tierCredits([[5, 6], [10, 11], [Infinity, 16]], duration);
  },
};

export const videoUpscaleUltra4k: VideoUpscaleModelConfig = {
  key: "ultra-4k",
  displayName: "Video Upscaler Ultra 4K",
  category: "video-upscale",
  // $0.08/s → 50% target margin.
  credits: ({ duration }) => {
    return tierCredits([[5, 22], [10, 43], [Infinity, 64]], duration);
  },
};
