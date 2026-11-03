import { clerkClient } from "@clerk/express";

/**
 * Admin-only facts we keep on the Clerk user rather than in our database:
 *
 * - `heardFrom`: the onboarding answer to "How did you hear about Unsora?"
 *   (`unsafeMetadata.heardFrom`, written by the client).
 * - `country`: where the user signs in from. Clerk resolves it from the IP
 *   address of each session, but sessions expire and take it with them, so
 *   `fillCountries` copies it to `privateMetadata.country` while a session
 *   is still around.
 */
export interface ClerkProfile {
  heardFrom: string | null;
  country: string | null;
}

type ClerkUser = {
  id: string;
  unsafeMetadata?: Record<string, unknown> | null;
  privateMetadata?: Record<string, unknown> | null;
};

const PAGE_SIZE = 500;
/** Clerk accepts up to 100 user ids per list call. */
const ID_BATCH = 100;
const CACHE_MS = 10 * 60 * 1000;

let cache: { at: number; profiles: Map<string, ClerkProfile> } | null = null;
let loading: Promise<Map<string, ClerkProfile>> | null = null;

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function profileOf(user: ClerkUser): ClerkProfile {
  return {
    heardFrom: text(user.unsafeMetadata?.heardFrom),
    country: text(user.privateMetadata?.country),
  };
}

function fresh() {
  return cache && Date.now() - cache.at < CACHE_MS ? cache.profiles : null;
}

/** Every user's profile, keyed by Clerk user id. Pages through Clerk; cached for ten minutes. */
export async function allProfiles(): Promise<Map<string, ClerkProfile>> {
  const cached = fresh();
  if (cached) return cached;
  loading ??= (async () => {
    const profiles = new Map<string, ClerkProfile>();
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data } = await clerkClient.users.getUserList({ limit: PAGE_SIZE, offset });
      for (const user of data) profiles.set(user.id, profileOf(user));
      if (data.length < PAGE_SIZE) break;
    }
    cache = { at: Date.now(), profiles };
    return profiles;
  })().finally(() => {
    loading = null;
  });
  return loading;
}

/** Profiles for a page of users, keyed by Clerk user id. */
export async function profilesFor(clerkIds: string[]): Promise<Map<string, ClerkProfile>> {
  const cached = fresh();
  if (cached) return cached;
  const profiles = new Map<string, ClerkProfile>();
  for (let i = 0; i < clerkIds.length; i += ID_BATCH) {
    const batch = clerkIds.slice(i, i + ID_BATCH);
    const { data } = await clerkClient.users.getUserList({ userId: batch, limit: batch.length });
    for (const user of data) profiles.set(user.id, profileOf(user));
  }
  return profiles;
}

/** One Clerk session: the device, browser and IP it was last used from. */
export interface SessionDevice {
  id: string;
  status: string;
  /** Epoch milliseconds. */
  lastActiveAt: number;
  ipAddress: string | null;
  city: string | null;
  country: string | null;
  deviceType: string | null;
  browser: string | null;
  isMobile: boolean;
}

/**
 * The user's sessions Clerk still has, newest first. Read live and never
 * stored: an IP address is personal data, and this way it disappears when
 * Clerk drops the session.
 */
export async function sessionDevices(clerkId: string): Promise<SessionDevice[]> {
  const { data } = await clerkClient.sessions.getSessionList({ userId: clerkId, limit: 20 });
  return data.map((session) => {
    const activity = session.latestActivity;
    const browser = [text(activity?.browserName), text(activity?.browserVersion)]
      .filter(Boolean)
      .join(" ");
    return {
      id: session.id,
      status: session.status,
      lastActiveAt: session.lastActiveAt,
      ipAddress: text(activity?.ipAddress),
      city: text(activity?.city),
      country: text(activity?.country),
      deviceType: text(activity?.deviceType),
      browser: browser || null,
      isMobile: Boolean(activity?.isMobile),
    };
  });
}

/** Country of the user's most recent session that has one, or null if none is left. */
async function sessionCountry(clerkId: string): Promise<string | null> {
  return (await sessionDevices(clerkId)).find((d) => d.country)?.country ?? null;
}

export async function saveCountry(clerkId: string, country: string) {
  // Clerk merges metadata, so other private keys are kept.
  await clerkClient.users.updateUserMetadata(clerkId, { privateMetadata: { country } });
  const profile = cache?.profiles.get(clerkId);
  if (profile) profile.country = country;
}

/** Users with no session left are checked again after this long. */
const RECHECK_MS = 6 * 60 * 60 * 1000;
/**
 * Session lookups per run, about five a second, well under Clerk's rate limit.
 * High enough that the first run after deploy covers every existing user.
 */
const MAX_LOOKUPS = 5000;
const LOOKUP_GAP_MS = 200;

const checkedWithoutCountry = new Map<string, number>();
let filling = false;

/** Saves the session country of every user who doesn't have one stored yet. */
export async function fillCountries(): Promise<{ looked: number; saved: number }> {
  if (filling) return { looked: 0, saved: 0 };
  filling = true;
  let looked = 0;
  let saved = 0;
  try {
    for (let offset = 0; looked < MAX_LOOKUPS; offset += PAGE_SIZE) {
      const { data } = await clerkClient.users.getUserList({ limit: PAGE_SIZE, offset });
      for (const user of data) {
        if (looked >= MAX_LOOKUPS) break;
        if (profileOf(user).country) continue;
        const checkedAt = checkedWithoutCountry.get(user.id);
        if (checkedAt && Date.now() - checkedAt < RECHECK_MS) continue;

        looked += 1;
        // A failure here is almost always Clerk rate-limiting or being down.
        // It throws out of the run, so we stop calling Clerk (the auth
        // middleware shares the same limit) and pick up again next hour.
        const country = await sessionCountry(user.id);
        if (country) {
          await saveCountry(user.id, country);
          checkedWithoutCountry.delete(user.id);
          saved += 1;
        } else {
          checkedWithoutCountry.set(user.id, Date.now());
        }
        await new Promise((resolve) => setTimeout(resolve, LOOKUP_GAP_MS));
      }
      if (data.length < PAGE_SIZE) break;
    }
  } finally {
    filling = false;
  }
  return { looked, saved };
}

const FILL_EVERY_MS = 60 * 60 * 1000;

/** Runs `fillCountries` shortly after boot and then every hour. */
export function startCountryFill() {
  const run = () =>
    fillCountries()
      .then(({ looked, saved }) => {
        if (looked) console.log(`[clerk-profile] countries: looked up ${looked}, saved ${saved}`);
      })
      // Countries saved before the failure are kept; the rest wait for the next run.
      .catch((error) =>
        console.error("[clerk-profile] country fill stopped, retrying next hour:", error),
      );
  setTimeout(run, 30 * 1000).unref();
  setInterval(run, FILL_EVERY_MS).unref();
}
