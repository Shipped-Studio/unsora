import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Spinner } from "@/components/ui/spinner";
import { safeRedirect } from "@/lib/clerk-errors";

export const metadata = { robots: { index: false } };

/**
 * Google sign-in lands here; Clerk finishes the sign-in or sign-up. The form
 * puts where each should go in this URL (`sign_in`, `sign_up`): Clerk drops
 * the sign-up's redirect when it turns it into a sign-in for an existing
 * account, which would send them to the fallback.
 */
export default async function SsoCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ sign_in?: string; sign_up?: string }>;
}) {
  const params = await searchParams;
  const signInTo = safeRedirect(params.sign_in, "/");
  const signUpTo = safeRedirect(params.sign_up, "/onboarding");

  return (
    <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
      <Spinner className="size-5" />
      Signing you in
      <AuthenticateWithRedirectCallback
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        continueSignUpUrl="/sign-up/continue"
        signInForceRedirectUrl={signInTo}
        signUpForceRedirectUrl={signUpTo}
      />
      {/* Transfers from sign-in to sign-up can trigger the bot check. */}
      <div id="clerk-captcha" className="empty:hidden" />
    </div>
  );
}
