import { isClerkAPIResponseError } from "@clerk/nextjs/errors";

const FALLBACK = "Something went wrong. Try again.";

type MaybeClerkError = {
  longMessage?: string;
  message?: string;
  errors?: { longMessage?: string; message?: string }[];
};

/** A readable message for any error Clerk hands back. */
export function clerkErrorMessage(error: unknown, fallback = FALLBACK): string {
  if (!error) return fallback;
  if (isClerkAPIResponseError(error)) {
    const first = error.errors[0];
    return first?.longMessage || first?.message || fallback;
  }
  const e = error as MaybeClerkError;
  if (e.errors?.[0]) return e.errors[0].longMessage || e.errors[0].message || fallback;
  if (e.longMessage) return e.longMessage;
  return fallback;
}

/** The first global (non-field) error from a Clerk hook, if any. */
export function globalErrorMessage(
  errors: { global: unknown[] | null } | undefined,
): string | null {
  const first = errors?.global?.[0];
  return first ? clerkErrorMessage(first) : null;
}

/**
 * Only follow same-site redirects. The value is resolved the way the browser
 * would (so tricks like `/\evil.com` or `/\t/evil.com` resolve off-site and
 * are refused) and only its path, query and hash are returned.
 */
export function safeRedirect(raw: string | null | undefined, fallback = "/") {
  if (!raw) return fallback;
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://app.invalid";
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return fallback;
    const path = `${url.pathname}${url.search}${url.hash}`;
    // "//host" would be read as a protocol-relative URL by the router.
    if (!path.startsWith("/") || path.startsWith("//")) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
