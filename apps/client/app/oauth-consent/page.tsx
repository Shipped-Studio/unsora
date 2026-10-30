import { Suspense } from "react";
import type { Metadata } from "next";
import { Spinner } from "@/components/ui/spinner";
import { ConnectorSetup } from "./connector-setup";

export const metadata: Metadata = {
  title: "Connect an app",
  robots: { index: false },
  // Without this the cross-origin POST to Clerk sends `Origin: null` and is rejected.
  referrer: "strict-origin-when-cross-origin",
};

/**
 * OAuth consent screen for MCP clients (Claude, ChatGPT, …). Clerk is the
 * authorization server; the Clerk Dashboard's Paths → "OAuth consent" setting
 * points here instead of the Account Portal page. Signed-out visitors sign in
 * or sign up on the page itself (account-step.tsx); proxy.ts lets them in.
 *
 * New users set up Unsora here (channels, how it works, free trial) before
 * the consent step, because allowing hands them straight back to the client
 * and an account with no channels or credits can't do anything there.
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
        <ConnectorSetup />
      </Suspense>
    </div>
  );
}
