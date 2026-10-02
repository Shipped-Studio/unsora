import { ImageModelConfig } from "./types";

// Image generation → 20% target margin. $0.035 flat regardless of quality.
const CREDITS_BY_QUALITY: Record<string, number> = {
  basic: 2,
  high: 2,
};

const config: ImageModelConfig = {
  key: "seedream-v5-lite",
  displayName: "ByteDance Seedream v5.0 Lite",
  category: "image",
  provider: "wavespeed",
  dbModel: "seedream_v5_lite",
  resolution: ["basic", "high"],
  aspectRatio: [
    "1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2",
  ],
  maxRefs: 14,
  credits: ({ resolution = "basic" }) => {
    return CREDITS_BY_QUALITY[resolution] ?? CREDITS_BY_QUALITY["basic"];
  },
};

export default config;
