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

/** Only follow same-site relative redirects. */
export function safeRedirect(raw: string | null | undefined, fallback = "/") {
  if (!raw) return fallback;
  try {
    if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
    const url = new URL(raw);
    if (typeof window !== "undefined" && url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}` || fallback;
    }
  } catch {
    // fall through
  }
  return fallback;
}
