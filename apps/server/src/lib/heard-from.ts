import { clerkClient } from "@clerk/express";

/**
 * Answers to "How did you hear about Unsora?". Onboarding saves them on the
 * Clerk user (`unsafeMetadata.heardFrom`), not in our database, so the admin
 * dashboard reads them from Clerk.
 */

const PAGE_SIZE = 500;
/** Clerk accepts up to 100 user ids per list call. */
const ID_BATCH = 100;
const CACHE_MS = 10 * 60 * 1000;

let cache: { at: number; answers: Map<string, string> } | null = null;
let loading: Promise<Map<string, string>> | null = null;

function answerOf(user: { unsafeMetadata?: Record<string, unknown> | null }) {
  const value = user.unsafeMetadata?.heardFrom;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function fresh() {
  return cache && Date.now() - cache.at < CACHE_MS ? cache.answers : null;
}

/** Every answer, keyed by Clerk user id. Pages through Clerk; cached for ten minutes. */
export async function allHeardFrom(): Promise<Map<string, string>> {
  const cached = fresh();
  if (cached) return cached;
  loading ??= (async () => {
    const answers = new Map<string, string>();
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data } = await clerkClient.users.getUserList({ limit: PAGE_SIZE, offset });
      for (const user of data) {
        const answer = answerOf(user);
        if (answer) answers.set(user.id, answer);
      }
      if (data.length < PAGE_SIZE) break;
    }
    cache = { at: Date.now(), answers };
    return answers;
  })().finally(() => {
    loading = null;
  });
  return loading;
}

/** Answers for a page of users, keyed by Clerk user id. Users who skipped the question are absent. */
export async function heardFromFor(clerkIds: string[]): Promise<Map<string, string>> {
  const cached = fresh();
  if (cached) return cached;
  const answers = new Map<string, string>();
  for (let i = 0; i < clerkIds.length; i += ID_BATCH) {
    const batch = clerkIds.slice(i, i + ID_BATCH);
    const { data } = await clerkClient.users.getUserList({ userId: batch, limit: batch.length });
    for (const user of data) {
      const answer = answerOf(user);
      if (answer) answers.set(user.id, answer);
    }
  }
  return answers;
}
