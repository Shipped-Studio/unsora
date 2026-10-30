/**
 * Shared by the two setups, which look the same and differ only in their
 * steps:
 *
 *   - the app's own onboarding after sign-up (app/(onboarding)/onboarding):
 *     channels → how it works → connect an AI agent → free trial
 *   - an AI app connecting through the MCP connector (app/oauth-consent):
 *     channels → how it works → free trial → allow
 *
 * The free trial is left out for anyone who already has a plan. The step
 * lives in the URL so it survives the OAuth and Stripe round trips.
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
  allow: "Allow",
} as const;

export type StepId = keyof typeof STEP_LABELS;

export interface SetupContext {
  /** The app being connected (ChatGPT, Claude, …); null in the app's own onboarding. */
  appName: string | null;
  appLogoUrl: string | null | undefined;
  /** This page's URL with the step set to `step` (and other own params dropped). */
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
