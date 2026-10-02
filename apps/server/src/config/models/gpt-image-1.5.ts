import { ImageModelConfig } from "./types";

// Image generation → 20% target margin. $0.05 flat across all sizes.
const CREDITS_BY_SIZE: Record<string, number> = {
  "1024x1024": 2,
  "1024x1536": 2,
  "1536x1024": 2,
};

const config: ImageModelConfig = {
  key: "gpt-image-1.5",
  displayName: "OpenAI GPT-Image 1.5",
  category: "image",
  provider: "wavespeed",
  dbModel: "gpt_image_1.5",
  resolution: ["1024x1024", "1024x1536", "1536x1024"],
  credits: ({ size = "1024x1024" }) => {
    return CREDITS_BY_SIZE[size] ?? CREDITS_BY_SIZE["1024x1024"];
  },
};

export default config;
