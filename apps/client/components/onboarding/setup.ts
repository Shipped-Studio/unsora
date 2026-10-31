/**
 * The app's onboarding after sign-up (app/(onboarding)/onboarding):
 *
 *   channels → how it works → connect an AI agent → free trial
 *
 * An account made while connecting ChatGPT or Claude (`?connect=`, see
 * connector-app.ts) gets the same steps, then one asking it to connect again
 * from that app:
 *
 *   channels → how it works → connect an AI agent → free trial → connect
 *
 * The free trial is left out for anyone who already has a plan. The step
 * lives in the URL so it survives the channel OAuth and Stripe round trips.
 */

/** The step's query param. */
export const SETUP_PARAM = "setup";
/** Added by the server to Stripe's return URL: `success` or `cancel`. */
export const CHECKOUT_PARAM = "checkout";

export const STEP_LABELS = {
  channels: "Channels",
  howto: "How it works",
  agents: "AI agent",
  trial: "Free trial",
  connect: "Connect",
} as const;

export type StepId = keyof typeof STEP_LABELS;

export interface SetupContext {
  /** This page's URL with the step set to `step`. */
  hrefFor: (step: StepId, extra?: Record<string, string>) => string;
  go: (step: StepId) => void;
  next: () => void;
  back: (() => void) | null;
  /** The current step is the last one, so `next` finishes the setup. */
  last: boolean;
}

/** Whether the usage response says the user has an active paid plan. */
export function hasPaidPlan(usage: { user: { plan: string | null; isActive: boolean } } | null | undefined) {
  const plan = (usage?.user.plan ?? "free").toLowerCase();
  return Boolean(usage?.user.isActive) && plan !== "free";
}

/** Accounts older than this skip onboarding even if they never finished it. */
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;

/**
 * A new account that hasn't finished onboarding (MarkOnboarded). Takes the
 * Clerk user from either the server (`createdAt` in ms) or the client (a Date).
 */
export function needsOnboarding(user: {
  unsafeMetadata?: Record<string, unknown>;
  createdAt: number | Date | null;
}): boolean {
  if (user.unsafeMetadata?.onboardedAt || !user.createdAt) return false;
  return Date.now() - Number(user.createdAt) < NEW_ACCOUNT_MS;
}
