import { clerkClient } from "@clerk/express";

export interface ClerkProfile {
  name: string | null;
  firstName: string | null;
  username: string | null;
  signupMethod: string | null;
}

/** Clerk external-account providers ("oauth_google") → a label. */
export function signupMethodFromProviders(providers: string[]): string {
  const joined = providers.join(",").toLowerCase();
  if (joined.includes("google")) return "Google";
  if (joined.includes("apple")) return "Apple";
  if (joined.includes("github")) return "GitHub";
  if (providers.length > 0) return "OAuth";
  return "Email / password";
}

/** Best-effort profile lookup for email copy; nulls on any failure. */
export async function fetchClerkProfile(clerkId: string): Promise<ClerkProfile> {
  try {
    const u = await clerkClient.users.getUser(clerkId);
    const providers = (u.externalAccounts ?? []).map((a) => a.provider ?? "");
    return {
      name: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || null,
      firstName: u.firstName ?? null,
      username: u.username ?? null,
      signupMethod: signupMethodFromProviders(providers),
    };
  } catch (err) {
    console.error("[email] Clerk profile fetch failed:", err);
    return { name: null, firstName: null, username: null, signupMethod: null };
  }
}
