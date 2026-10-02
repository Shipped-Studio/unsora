import { VideoModelConfig, tierCredits } from "./types";

// Turbo 720p $0.14/s → 50% target margin. No video-input premium at the provider,
// so both tiers price identically.
const TIERS_NO_VIDEO: [number, number][] = [[5, 37], [10, 74], [15, 111]];
const TIERS_VIDEO: [number, number][] = [[5, 37], [10, 74], [15, 111]];

const config: VideoModelConfig = {
  key: "seedance-2.0-fast",
  displayName: "Seedance 2.0 Fast",
  category: "video",
  provider: "wavespeed",
  dbModel: "seedance_2.0_fast",
  endpoints: {
    textToVideo: "bytedance/seedance-2.0-fast/text-to-video",
    imageToVideo: "bytedance/seedance-2.0-fast/image-to-video",
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
