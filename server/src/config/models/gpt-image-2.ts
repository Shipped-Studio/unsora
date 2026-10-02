import { ImageModelConfig } from "./types";

// Image generation → 20% target margin. 1K $0.07, 2K $0.11, 4K $0.1805.
// Influencer Studio and Movie Materials derive their cost from this table.
const CREDITS_BY_RESOLUTION: Record<string, number> = {
  "1k": 3,
  "2k": 4,
  "4k": 6,
};

const config: ImageModelConfig = {
  key: "gpt-image-2",
  displayName: "OpenAI GPT Image 2",
  category: "image",
  provider: "wavespeed",
  dbModel: "gpt_image_2",
  resolution: ["1k", "2k", "4k"],
  endpoints: {
    textToImage: "openai/gpt-image-2/text-to-image",
    imageToImage: "openai/gpt-image-2/image-to-image",
  },
  // WaveSpeed GPT Image 2 supported aspect ratios (+ "auto" → omitted from payload).
  aspectRatio: [
    "auto",
    "1:1",
    "9:16",
    "16:9",
    "4:3",
    "3:4",
    "2:3",
    "3:2",
    "4:5",
    "5:4",
    "21:9",
  ],
  maxRefs: 16,
  credits: ({ resolution = "1k" }) => {
    return CREDITS_BY_RESOLUTION[resolution] ?? CREDITS_BY_RESOLUTION["1k"];
  },
};

export default config;
