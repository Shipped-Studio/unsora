import { CHECKOUT_PARAM, SETUP_PARAM } from "@/components/onboarding/setup";

/** Params this page adds; never forwarded to Clerk with the consent. */
export const OWN_PARAMS: string[] = [SETUP_PARAM, CHECKOUT_PARAM];
