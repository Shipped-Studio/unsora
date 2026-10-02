import { VideoModelConfig, tierCredits } from "./types";

const config: VideoModelConfig = {
  key: "kling-standard",
  displayName: "Kling v3.0 Standard",
  category: "video",
  provider: "wavespeed",
  dbModel: "kling_v3_std",
  endpoints: {
    textToVideo: "kwaivgi/kling-v3.0-std/text-to-video",
    imageToVideo: "kwaivgi/kling-v3.0-std/image-to-video",
  },
  supportsSound: true,
  supportsNegativePrompt: true,
  durationRange: [1, 15],
  aspectRatio: ["16:9", "1:1", "9:16"],
  // Kling 3.0 $0.28/s → 50% target margin. The provider charges no premium for
  // sound, so both variants price identically.
  credits: ({ duration }) =>
    tierCredits([[5, 74], [10, 148], [15, 222]], duration),
};

export default config;
