import type { MovieMaterialsConfig } from "./types";

export const movieMaterialsConfig: MovieMaterialsConfig = {
  validModes: [
    "face",
    "wide-body",
    "sheet",
    "location",
    "first-frame",
    "style-collage",
    "multishot-2x4",
    "multishot-1x4",
  ],
  validRatios: ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"],
  validResolutions: ["1k", "2k", "4k"],
  maxReferenceImages: 14,
};
