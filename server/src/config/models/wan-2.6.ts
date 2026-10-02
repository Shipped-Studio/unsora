import { VideoModelConfig, tierCredits } from "./types";

// ⚠ Priced by ANALOGY (old × 3.7, the Kling v3.0 credit multiple) — Wan's true
// vendor cost is unknown, so these margins are unverified. Confirm before relying on them.
const TIERS_720P: [number, number][] = [[5, 74], [10, 148], [15, 222]];
const TIERS_1080P: [number, number][] = [[5, 111], [10, 222], [15, 333]];

const config: VideoModelConfig = {
  key: "wan",
  displayName: "Alibaba Wan 2.6",
  category: "video",
  provider: "wavespeed",
  dbModel: "wan_2.6",
  endpoints: {
    textToVideo: "alibaba/wan-2.6/text-to-video",
    imageToVideo: "alibaba/wan-2.6/image-to-video",
  },
  supportsSound: false,
  supportsNegativePrompt: true,
  durationRange: [5, 15],
  aspectRatio: ["16:9", "9:16"],
  resolution: ["720p", "1080p"],
  credits: ({ duration, resolution }) => {
    const tiers = resolution === "1080p" ? TIERS_1080P : TIERS_720P;
    return tierCredits(tiers, duration);
  },
};

export default config;
