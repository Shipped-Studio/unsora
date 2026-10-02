import { VideoModelConfig, tierCredits } from "./types";

// Mini 720p $0.12/s → 50% target margin. No video-input premium at the provider,
// so both tiers price identically.
const TIERS_NO_VIDEO: [number, number][] = [[5, 32], [10, 64], [15, 95]];
const TIERS_VIDEO: [number, number][] = [[5, 32], [10, 64], [15, 95]];

const config: VideoModelConfig = {
  key: "seedance-2.0-mini",
  displayName: "Seedance 2.0 Mini",
  category: "video",
  provider: "wavespeed",
  dbModel: "seedance_2.0_mini",
  endpoints: {
    textToVideo: "bytedance/seedance-2.0-mini/text-to-video",
    imageToVideo: "bytedance/seedance-2.0-mini/image-to-video",
  },
  supportsSound: false,
  supportsNegativePrompt: false,
  durationRange: [4, 15],
  aspectRatio: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
  maxFiles: { images: 9, videos: 3, audio: 3 },
  outputResolution: "720p",
  /**
   * Credits vary by whether the request includes a video reference input.
   * Pass `sound: true` when video input is present (maps to the "video" tier).
   */
  credits: ({ duration, sound: hasVideoInput }) => {
    const tiers = hasVideoInput ? TIERS_VIDEO : TIERS_NO_VIDEO;
    return tierCredits(tiers, duration);
  },
};

export default config;
