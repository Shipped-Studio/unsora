import type { InfluencerConfig } from "./types";

export const influencerConfig: InfluencerConfig = {
  validRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
  cameraAngles: ["pov", "portrait", "full-body", "close-up", "side-profile"],
  styleModes: [
    "ugc",
    "casual_daylight",
    "cozy_indoor",
    "low_light_intimate",
    "raw_flash",
    "golden_hour",
    "moody_night",
    "car_selfie",
    "mirror_selfie",
    "luxury_influencer",
    "cinematic",
    "travel_content",
    "beauty_closeup",
    "party_night_out",
  ],
  minAge: 18,
  maxAge: 70,
  maxCount: 10,
};
