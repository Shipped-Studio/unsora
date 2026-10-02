/**
 * Copy used by the billing page. Lives next to the components that render it
 * so a copy tweak doesn't require touching the page orchestrator.
 */

export const CANCEL_REASONS = [
  "Too expensive",
  "Not using it enough",
  "Missing features I need",
  "Found a better alternative",
  "Quality didn't meet expectations",
  "Other",
] as const;

export type CancelReason = (typeof CANCEL_REASONS)[number];

export const UPCOMING_FEATURES = [
  "API Access for developers",
  "Team collaboration & shared workspaces",
  "Custom AI model fine-tuning",
  "Advanced analytics dashboard",
  "Batch processing improvements",
  "New AI models (DALL-E 4, Sora v3)",
  "Mobile app (iOS & Android)",
  "Priority rendering queue",
] as const;
