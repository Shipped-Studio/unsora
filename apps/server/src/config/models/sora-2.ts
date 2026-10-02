import { VideoModelConfig, tierCredits } from "./types";

const config: VideoModelConfig = {
  key: "sora-2",
  displayName: "OpenAI Sora 2",
  category: "video",
  provider: "wavespeed",
  dbModel: "sora_2",
  endpoints: {
    textToVideo: "openai/sora-2/text-to-video",
    imageToVideo: "openai/sora-2/image-to-video",
  },
  supportsSound: false,
  supportsNegativePrompt: false,
  durationRange: [4, 20],
  durations: [4, 8, 12, 16, 20],
  aspectRatio: ["16:9", "9:16"],
  // $0.10/s flat → 50% target margin.
  credits: ({ duration }) => {
    return tierCredits(
      [[4, 22], [8, 43], [12, 64], [16, 85], [20, 106]],
      duration,
    );
  },
};

export default config;
