import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { UnsoraLogo } from "@/components/brand/unsora-logo";
import { Spinner } from "@/components/ui/spinner";
import { ConnectorFlow } from "./connector-flow";

export const metadata: Metadata = {
  title: "Connect an app",
  robots: { index: false },
  // Without this the cross-origin POST to Clerk sends `Origin: null` and is rejected.
  referrer: "strict-origin-when-cross-origin",
};

/**
 * OAuth consent screen for MCP clients (Claude, ChatGPT, …), with a short
 * onboarding in front of it for new users (see connector-flow.tsx). Clerk is
 * the authorization server; the Clerk Dashboard's Paths → "OAuth consent"
 * setting points here instead of the Account Portal page. Signed-out
 * visitors are sent to /sign-in and back by proxy.ts.
 */
export default function OAuthConsentPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background px-4 py-6 sm:px-10">
      <Link href="https://tryunsora.com" className="inline-flex w-fit">
        <UnsoraLogo variant="full" priority className="h-7" />
      </Link>

      {/* Top-aligned so the stepper stays put as the steps change height. */}
      <main className="flex flex-1 justify-center pt-10 pb-12 sm:pt-14">
        <div className="w-full">
          <Suspense fallback={<Spinner className="mx-auto size-6 text-muted-foreground" />}>
            <ConnectorFlow />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
