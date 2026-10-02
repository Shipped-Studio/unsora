import { VideoModelConfig, tierCredits } from "./types";

const config: VideoModelConfig = {
  key: "veo-fast",
  displayName: "Google Veo 3.1 Fast",
  category: "video",
  provider: "wavespeed",
  dbModel: "veo3_1_fast",
  endpoints: {
    textToVideo: "google/veo3.1-fast/text-to-video",
    imageToVideo: "google/veo3.1-fast/image-to-video",
    referenceToVideo: "google/veo3.1-fast/reference-to-video",
    videoExtend: "google/veo3.1-fast/video-extend",
  },
  supportsSound: true,
  supportsNegativePrompt: true,
  durationRange: [4, 8],
  durations: [4, 6, 8],
  aspectRatio: ["16:9", "9:16"],
  resolution: ["720p", "1080p"],
  // ⚠ Priced by ANALOGY (old × 1.19, the Google Veo 3.1 credit multiple) — the
  // provider's true per-second cost is unknown, so the margin is unverified.
  credits: ({ duration, sound }) =>
    sound
      ? tierCredits([[4, 33], [6, 49], [8, 65]], duration)
      : tierCredits([[4, 22], [6, 33], [8, 43]], duration),
};

export default config;
