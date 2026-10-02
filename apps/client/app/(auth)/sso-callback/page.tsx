import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Spinner } from "@/components/ui/spinner";

export const metadata = { robots: { index: false } };

/** Google sign-in lands here; Clerk finishes the sign-in or sign-up. */
export default function SsoCallbackPage() {
  return (
    <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
      <Spinner className="size-5" />
      Signing you in
      <AuthenticateWithRedirectCallback
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        continueSignUpUrl="/sign-up/continue"
        signUpFallbackRedirectUrl="/onboarding"
        signInFallbackRedirectUrl="/"
      />
      {/* Transfers from sign-in to sign-up can trigger the bot check. */}
      <div id="clerk-captcha" className="empty:hidden" />
    </div>
  );
}
