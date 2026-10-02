import { MotionControlModelConfig, tierCredits } from "./types";

// Motion Control $0.28/s → 50% target margin. Same provider cost across all
// Motion Control variants, so they price identically.
// ⚠ Still assumes the flat $0.28/s cost; revisit if Unsora shares NuvedaAI's
// dead-code billing bug.
const TIERS: [number, number][] = [
  [5, 74], [10, 148], [15, 222], [20, 295], [25, 369], [30, 443],
];

const config: MotionControlModelConfig = {
  key: "kling-mc-3.0-pro",
  displayName: "Kling 3.0 Motion Control Pro",
  category: "motion-control",
  provider: "wavespeed",
  dbModel: "kling_mc_3.0_pro",
  validResolutions: ["1080p"],
  validOrientations: ["video", "image"],
  durationRange: [5, 30],
  credits: ({ duration }) => tierCredits(TIERS, duration),
};

export default config;
