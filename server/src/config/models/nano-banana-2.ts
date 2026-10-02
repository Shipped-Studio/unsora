import { ImageModelConfig } from "./types";

// Image generation → 20% target margin. $0.039 / $0.078 / $0.156 by resolution.
const CREDITS_BY_RESOLUTION: Record<string, number> = {
  "1k": 2,
  "2k": 3,
  "4k": 6,
};

const config: ImageModelConfig = {
  key: "nano-banana-2",
  displayName: "Google Nano Banana 2",
  category: "image",
  provider: "wavespeed",
  dbModel: "nano-banana-2",
  resolution: ["1k", "2k", "4k"],
  aspectRatio: [
    "auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3",
    "4:5", "5:4", "21:9", "1:4", "4:1", "1:8", "8:1",
  ],
  maxRefs: 14,
  credits: ({ resolution = "2k" }) => {
    return CREDITS_BY_RESOLUTION[resolution] ?? CREDITS_BY_RESOLUTION["2k"];
  },
};

export default config;
