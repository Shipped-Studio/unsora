/** Disposable-email domains that never get free signup credits. */
const BLOCKED_SIGNUP_DOMAINS = ["delaeb.com", "gyknife.com", "necub.com", "gusronk.com"];

/** True when the address is on (or under) a blocked domain. */
export function isBlockedSignupEmail(email: string): boolean {
  const domain = email.split("@").pop()?.trim().toLowerCase() ?? "";
  return BLOCKED_SIGNUP_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}
