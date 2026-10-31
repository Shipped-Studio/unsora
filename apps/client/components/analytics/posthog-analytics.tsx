"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";

// The phc_ project key is public by design (it ships in the client bundle).
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

/**
 * PostHog product analytics: page views and clicks, no session recording.
 * Signed-in people are identified by their Clerk id only (no email or
 * name), and the identity is dropped again on sign-out. Off when the key
 * isn't set, as in local development.
 */
export function PostHogAnalytics() {
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? null;
  const identified = useRef<string | null>(null);

  useEffect(() => {
    if (!POSTHOG_KEY || posthog.__loaded) return;
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      defaults: "2026-08-30",
      disable_session_recording: true,
    });
  }, []);

  useEffect(() => {
    if (!POSTHOG_KEY || !isLoaded || identified.current === userId) return;
    if (userId) posthog.identify(userId);
    else posthog.reset();
    identified.current = userId;
  }, [isLoaded, userId]);

  return null;
}
