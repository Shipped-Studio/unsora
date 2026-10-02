import { VideoModelConfig, tierCredits } from "./types";

const config: VideoModelConfig = {
  key: "sora-2-pro",
  displayName: "OpenAI Sora 2 Pro",
  category: "video",
  provider: "wavespeed",
  dbModel: "sora_2_pro",
  endpoints: {
    textToVideo: "openai/sora-2-pro/text-to-video",
    imageToVideo: "openai/sora-2-pro/image-to-video",
  },
  supportsSound: false,
  supportsNegativePrompt: false,
  durationRange: [4, 20],
  durations: [4, 8, 12, 16, 20],
  aspectRatio: ["16:9", "9:16"],
  // 720p $0.30/s → 50% target margin.
  credits: ({ duration }) => {
    return tierCredits(
      [[4, 64], [8, 127], [12, 190], [16, 253], [20, 316]],
      duration,
    );
  },
};

export default config;
