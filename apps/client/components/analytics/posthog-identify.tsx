"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";

/**
 * Links session recordings to the signed-in person by their Clerk id (no
 * email or name), and drops it again on sign-out. PostHog itself starts in
 * PostHogProvider.
 */
export function PostHogIdentify() {
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? null;
  const identified = useRef<string | null>(null);

  useEffect(() => {
    if (!posthog.__loaded || !isLoaded || identified.current === userId) return;
    if (userId) posthog.identify(userId);
    else posthog.reset();
    identified.current = userId;
  }, [isLoaded, userId]);

  return null;
}
