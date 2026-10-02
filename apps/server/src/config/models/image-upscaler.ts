import type { ImageUpscaleConfig } from "./types";

// Upscaling is an enhancement, not image generation → 50% target margin.
// $0.02 / $0.04 / $0.08 by resolution.
export const imageUpscaleConfig: ImageUpscaleConfig = {
  validResolutions: ["2k", "4k", "8k"],
  credits: {
    "2k": 2,
    "4k": 3,
    "8k": 5,
  },
};
