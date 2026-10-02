import { VideoModelConfig, tierCredits } from "./types";

const config: VideoModelConfig = {
  key: "veo-lite",
  displayName: "Google Veo 3.1 Lite",
  category: "video",
  provider: "wavespeed",
  dbModel: "veo3_1_lite",
  endpoints: {
    textToVideo: "google/veo3.1-lite/text-to-video",
    imageToVideo: "google/veo3.1-lite/image-to-video",
    startEndToVideo: "google/veo3.1-lite/start-end-to-video",
  },
  supportsSound: true,
  supportsNegativePrompt: true,
  durationRange: [4, 8],
  durations: [4, 6, 8],
  aspectRatio: ["16:9", "9:16"],
  resolution: ["720p", "1080p"],
  // $0.30/s → 50% target margin. Audio is free on Lite, so sound doesn't change the price.
  credits: ({ duration }) =>
    tierCredits([[4, 64], [6, 95], [8, 127]], duration),
};

export default config;
