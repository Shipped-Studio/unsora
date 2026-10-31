"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { PostHogIdentify } from "./posthog-identify";

// The phc_ project token is public by design (it ships in the client bundle).
const POSTHOG_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

/**
 * PostHog, set up as in the earlier Unsora app: session replay (switched on
 * in the PostHog project settings) plus PostHog's default page views and
 * clicks. Inputs are masked in recordings by default. Requests go through
 * this domain's /uxr proxy (next.config.ts) so blockers don't drop them.
 * Off when the token isn't set, as in local development.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!POSTHOG_TOKEN || posthog.__loaded) return;
    posthog.init(POSTHOG_TOKEN, {
      api_host: "/uxr",
      ui_host: "https://us.posthog.com",
      person_profiles: "identified_only",
      defaults: "2026-08-30",
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      {children}
      <PostHogIdentify />
    </PHProvider>
  );
}
