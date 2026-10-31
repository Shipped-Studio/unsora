import type { NextConfig } from "next";
import { checkEnv } from "./check-env";

// Abort dev/build with a clear message if any required env var is missing.
checkEnv();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "stsadekirfan532192938747.blob.core.windows.net" },
      { protocol: "https", hostname: "files.tryunsora.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
  // v2 scheduler URLs. Query strings pass through, which matters for the
  // OAuth callbacks that still land on /scheduler/connections.
  async redirects() {
    return [
      { source: "/scheduler", destination: "/", permanent: false },
      // The old "All tools" page; tools live in the sidebar's Create menu.
      { source: "/create", destination: "/", permanent: false },
      { source: "/scheduler/connections", destination: "/scheduler/accounts", permanent: false },
      { source: "/scheduler/posts/create", destination: "/scheduler/new", permanent: false },
      { source: "/scheduler/posts/edit/:id", destination: "/scheduler/posts/:id/edit", permanent: false },
      { source: "/scheduler/posts/calendar", destination: "/scheduler/calendar", permanent: false },
      { source: "/scheduler/posts/draft", destination: "/scheduler/posts?status=drafts", permanent: false },
      { source: "/scheduler/posts/scheduled", destination: "/scheduler/posts?status=scheduled", permanent: false },
      { source: "/scheduler/posts/published", destination: "/scheduler/posts?status=published", permanent: false },
      { source: "/scheduler/posts/posted", destination: "/scheduler/posts?status=published", permanent: false },
    ];
  },
  // PostHog through this domain (see components/analytics/posthog-provider.tsx),
  // so browsers that block its servers (Brave, ad blockers) still send
  // recordings. The path is deliberately not "posthog" or "analytics",
  // which blockers also match. proxy.ts skips it.
  async rewrites() {
    return [
      { source: "/uxr/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
      { source: "/uxr/array/:path*", destination: "https://us-assets.i.posthog.com/array/:path*" },
      { source: "/uxr/:path*", destination: "https://us.i.posthog.com/:path*" },
    ];
  },
  // PostHog's API paths end in a slash (/e/, /flags/); keep them as sent.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
