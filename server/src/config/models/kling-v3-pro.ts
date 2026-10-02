import { VideoModelConfig, tierCredits } from "./types";

const config: VideoModelConfig = {
  key: "kling-pro",
  displayName: "Kling v3.0 Pro",
  category: "video",
  provider: "wavespeed",
  dbModel: "kling_v3_pro",
  endpoints: {
    textToVideo: "kwaivgi/kling-v3.0-pro/text-to-video",
    imageToVideo: "kwaivgi/kling-v3.0-pro/image-to-video",
  },
  supportsSound: true,
  supportsNegativePrompt: true,
  durationRange: [3, 15],
  aspectRatio: ["16:9", "1:1", "9:16"],
  // Pro costs the provider the same as Standard ($0.28/s) and sound carries no
  // premium, so every Kling v3.0 variant prices identically at a 50% target.
  credits: ({ duration }) =>
    tierCredits([[5, 74], [10, 148], [15, 222]], duration),
};

export default config;
