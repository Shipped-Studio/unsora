import { VideoModelConfig, tierCredits } from "./types";

const config: VideoModelConfig = {
  key: "veo",
  displayName: "Google Veo 3.1",
  category: "video",
  provider: "wavespeed",
  dbModel: "veo3_1",
  endpoints: {
    textToVideo: "google/veo3.1/text-to-video",
    imageToVideo: "google/veo3.1/image-to-video",
    referenceToVideo: "google/veo3.1/reference-to-video",
    videoExtend: "google/veo3.1/video-extend",
  },
  supportsSound: true,
  supportsNegativePrompt: true,
  durationRange: [4, 8],
  durations: [4, 6, 8],
  aspectRatio: ["16:9", "9:16"],
  resolution: ["720p", "1080p"],
  // Silent $0.20/s, audio $0.40/s → 50% target margin.
  credits: ({ duration, sound }) =>
    sound
      ? tierCredits([[4, 85], [6, 127], [8, 169]], duration)
      : tierCredits([[4, 43], [6, 64], [8, 85]], duration),
};

export default config;
