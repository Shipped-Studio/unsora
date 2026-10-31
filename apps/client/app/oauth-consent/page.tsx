import { Suspense } from "react";
import type { Metadata } from "next";
import { Spinner } from "@/components/ui/spinner";
import { ConsentScreen } from "./consent-screen";

export const metadata: Metadata = {
  title: "Connect an app",
  robots: { index: false },
  // Without this the cross-origin POST to Clerk sends `Origin: null` and is rejected.
  referrer: "strict-origin-when-cross-origin",
};

/**
 * OAuth consent screen for MCP clients (Claude, ChatGPT, …). Clerk is the
 * authorization server; the Clerk Dashboard's Paths → "OAuth consent" setting
 * points here instead of the Account Portal page. Signed-out visitors go
 * through /sign-in first (proxy.ts); new accounts set up before they can
 * connect (consent-screen.tsx).
 */
export default function OAuthConsentPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        }
      >
        <ConsentScreen />
      </Suspense>
    </div>
  );
}
