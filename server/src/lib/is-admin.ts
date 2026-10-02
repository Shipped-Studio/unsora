/**
 * Single source of truth for "is this user an admin?".
 *
 * Authorisation is granted when EITHER:
 *   1. `User.role === "ADMIN"`   ← canonical, migrate everyone here eventually
 *   2. the email is listed in the `ADMIN_EMAILS` env var (comma separated)
 *
 * Used by the admin middleware (route guard) and by the /user/usage endpoint
 * (so the web client knows whether to render the /admin entry point).
 */

let cachedRaw: string | undefined;
let cachedSet: Set<string> = new Set();

/** Parse + memoise the ADMIN_EMAILS env list (lower-cased, trimmed). */
export function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSet = new Set(
      raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    );
  }
  return cachedSet;
}

export function emailIsAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().has(email.toLowerCase());
}

export function userIsAdmin(user: {
  role?: string | null;
  email?: string | null;
}): boolean {
  if (user.role === "ADMIN") return true;
  return emailIsAdmin(user.email);
}
