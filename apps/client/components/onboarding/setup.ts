/**
 * The app's onboarding after sign-up (app/(onboarding)/onboarding):
 *
 *   where you heard about us → channels → how it works → free trial → credits
 *
 * An account made while connecting ChatGPT or Claude (`?connect=`, see
 * connector-app.ts) gets the same steps, then one asking it to connect again
 * from that app:
 *
 *   where you heard about us → channels → how it works → free trial → credits → connect
 *
 * The free trial and credits are left out for anyone who already has a plan.
 * The trial doesn't include credits, so that step offers clipping and AI
 * credits on top; it can be skipped. The step lives in the URL so it survives
 * the channel OAuth and Stripe round trips.
 */

/** The step's query param. */
export const SETUP_PARAM = "setup";
/** Added by the server to Stripe's return URL: `success` or `cancel`. */
export const CHECKOUT_PARAM = "checkout";
/** The credits step's second screen, `packs`; without it, the question. */
export const VIEW_PARAM = "view";
export const PACKS_VIEW = "packs";
/** A credit purchase's result on the packs screen: `success` or `cancel`. */
export const TOPUP_PARAM = "topup";
/** How many credits a successful purchase added. */
export const CREDITS_PARAM = "credits";

export const STEP_LABELS = {
  source: "About you",
  channels: "Channels",
  howto: "How it works",
  trial: "Free trial",
  credits: "Credits",
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
