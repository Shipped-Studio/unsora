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
 * Origin of this app's Clerk Frontend API (e.g. https://clerk.tryunsora.com),
 * read from the publishable key: `pk_<env>_<base64("host$")>`.
 */
const CLERK_FRONTEND_ORIGIN = (() => {
  const encoded = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.split("_")[2];
  if (!encoded) return null;
  try {
    return `https://${atob(encoded).replace(/\$$/, "")}`;
  } catch {
    return null;
  }
})();

/**
 * Only follow same-site redirects, plus Clerk's own OAuth endpoints. The value is resolved the way the browser
 * would (so tricks like `/\evil.com` or `/\t/evil.com` resolve off-site and
 * are refused) and only its path, query and hash are returned.
 */
export function safeRedirect(raw: string | null | undefined, fallback = "/") {
  if (!raw) return fallback;
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://app.invalid";
  try {
    const url = new URL(raw, origin);
    // MCP connectors (ChatGPT, Claude) send signed-out users here with a
    // redirect back to Clerk's /oauth/authorize, which then shows our consent
    // screen. That's our own Clerk Frontend API, so it's safe to follow.
    if (url.origin === CLERK_FRONTEND_ORIGIN && url.pathname.startsWith("/oauth/")) {
      return url.toString();
    }
    if (url.origin !== origin) return fallback;
    const path = `${url.pathname}${url.search}${url.hash}`;
    // "//host" would be read as a protocol-relative URL by the router.
    if (!path.startsWith("/") || path.startsWith("//")) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
