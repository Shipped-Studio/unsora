/**
 * The app's onboarding after sign-up (app/(onboarding)/onboarding):
 *
 *   where you heard about us → channels → how it works → free trial → credits
 *
 * The free trial step (`plan` in the URL) is the scheduler. The trial
 * includes no credits, so the credits step after it offers the one-time
 * packs; it can be skipped. AI Studio (monthly credits) is sold in the app,
 * not here.
 *
 * An account made while connecting ChatGPT or Claude (`?connect=`, see
 * connector-app.ts) gets the same steps, then one asking it to connect again
 * from that app:
 *
 *   where you heard about us → channels → how it works → free trial → credits → connect
 *
 * The free trial and credits steps are left out for anyone who already has a
 * scheduler plan, and the credits step for anyone already on AI Studio. The
 * step lives in the URL so it survives the channel OAuth and Stripe round
 * trips.
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
  plan: "Free trial",
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

/** Whether the usage response says the user has an active scheduler plan. */
export function hasPaidPlan(usage: { user: { plan: string | null; isActive: boolean } } | null | undefined) {
  const plan = (usage?.user.plan ?? "free").toLowerCase();
  return Boolean(usage?.user.isActive) && plan !== "free";
}

/** Accounts older than this skip onboarding even if they never finished it. */
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;

/**
 * Accounts made from here on must finish onboarding before using the app
 * (mustFinishOnboarding). Older ones were only offered it for their first
 * day, and keep that, so nobody already using the app is locked out.
 */
const ONBOARDING_REQUIRED_FROM = Date.parse("2026-11-10T00:00:00Z");

type OnboardingUser = {
  unsafeMetadata?: Record<string, unknown>;
  createdAt: number | Date | null;
};

/**
 * An account that has to finish onboarding before the rest of the app: made
 * after ONBOARDING_REQUIRED_FROM, not marked onboarded (MarkOnboarded), and
 * without a paid plan. The plan check means a payer is never held here, even
 * if the onboarded flag hasn't saved yet. `plan` (scheduler) and `creditsPlan`
 * (Monthly credits) are what the Stripe webhooks keep in Clerk's metadata;
 * either one counts.
 */
export function mustFinishOnboarding(user: OnboardingUser): boolean {
  if (user.unsafeMetadata?.onboardedAt || !user.createdAt) return false;
  if (Number(user.createdAt) < ONBOARDING_REQUIRED_FROM) return false;
  if (user.unsafeMetadata?.creditsPlan) return false;
  const plan = String(user.unsafeMetadata?.plan ?? "free").trim().toLowerCase();
  return plan === "" || plan === "free";
}

/**
 * An account that hasn't finished onboarding and may go through it: one that
 * must (mustFinishOnboarding), or an older one in its first day. Takes the
 * Clerk user from either the server (`createdAt` in ms) or the client (a Date).
 */
export function needsOnboarding(user: OnboardingUser): boolean {
  if (user.unsafeMetadata?.onboardedAt || !user.createdAt) return false;
  if (mustFinishOnboarding(user)) return true;
  return Date.now() - Number(user.createdAt) < NEW_ACCOUNT_MS;
}

/** `trial` is the free trial step's older name, still in old Stripe return URLs. */
export function normalizeStep(step: string | null): StepId | null {
  if (step === "trial") return "plan";
  return step && step in STEP_LABELS ? (step as StepId) : null;
}
