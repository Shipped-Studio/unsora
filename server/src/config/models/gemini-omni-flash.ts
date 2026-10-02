import { VideoModelConfig, tierCredits } from "./types";

// Omni Flash 720p flat $0.14/s (image rate; text is $0.13/s — credits() can't
// see the mode, so both are priced at the image rate) → 50% target margin.
// Reference-to-video (multiple reference images) costs $0.16/s at the provider.
// Audio is always generated natively; there is no toggle and no surcharge.
const TIERS: [number, number][] = [[5, 37], [10, 74]];
const TIERS_REFERENCE: [number, number][] = [[5, 43], [10, 85]];

const config: VideoModelConfig = {
  key: "gemini-omni-flash",
  displayName: "Gemini Omni Flash",
  category: "video",
  provider: "wavespeed",
  dbModel: "gemini_omni_flash",
  endpoints: {
    textToVideo: "google/gemini-omni-flash/text-to-video",
    imageToVideo: "google/gemini-omni-flash/image-to-video",
    referenceToVideo: "google/gemini-omni-flash/reference-to-video",
  },
  supportsSound: false,
  supportsNegativePrompt: false,
  durationRange: [3, 10],
  aspectRatio: ["16:9", "9:16"],
  maxFiles: { images: 4 },
  outputResolution: "720p",
  /**
   * `sound: true` is overloaded to mean "reference-to-video" (reference images
   * attached) — that endpoint bills at a higher per-second rate.
   */
  credits: ({ duration, sound: isReference }) =>
    tierCredits(isReference ? TIERS_REFERENCE : TIERS, duration),
};

export default config;
