export const CANCEL_REASONS = [
  "Too expensive",
  "Not using it enough",
  "Missing features I need",
  "Found a better alternative",
  "Quality didn't meet expectations",
  "Other",
] as const;

export type CancelReason = (typeof CANCEL_REASONS)[number];
