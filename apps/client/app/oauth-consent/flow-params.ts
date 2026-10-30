/**
 * Query params the connector flow adds to /oauth-consent for its own
 * navigation. Everything else on the URL is Clerk's OAuth request and is
 * forwarded to Clerk with the consent; these must not be.
 */
export const FLOW_PARAMS = ["step", "checkout", "trial", "status", "provider", "error"] as const;
