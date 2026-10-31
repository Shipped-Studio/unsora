import posthog from "posthog-js";

/*
 * PostHog session replay, started before the app renders (Next.js runs this
 * file first in the browser). Replay only: no page views, page leaves or
 * autocaptured clicks. Inputs are masked in recordings by default.
 * Recording also has to be switched on in the PostHog project settings.
 * Off when the token isn't set, as in local development.
 */
const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (token) {
  posthog.init(token, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    defaults: "2026-08-30",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
  });
}
