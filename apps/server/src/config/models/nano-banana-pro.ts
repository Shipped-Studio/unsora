import { ImageModelConfig } from "./types";

// Image generation → 20% target margin. 1k/2k $0.139, 4k $0.24.
const CREDITS_BY_RESOLUTION: Record<string, number> = {
  "1k": 5,
  "2k": 5,
  "4k": 8,
};

const config: ImageModelConfig = {
  key: "nano-banana-pro",
  displayName: "Google Nano Banana Pro",
  category: "image",
  provider: "wavespeed",
  dbModel: "nano-banana-pro",
  resolution: ["1k", "2k", "4k"],
  aspectRatio: [
    "1:1", "2:3", "3:4", "4:5", "3:2", "4:3", "5:4", "16:9", "21:9",
  ],
  maxRefs: 14,
  credits: ({ resolution = "2k" }) => {
    return CREDITS_BY_RESOLUTION[resolution] ?? CREDITS_BY_RESOLUTION["2k"];
  },
};

export default config;
