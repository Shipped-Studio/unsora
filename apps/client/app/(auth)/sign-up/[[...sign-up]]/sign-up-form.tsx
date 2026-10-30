"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { clerkErrorMessage, globalErrorMessage, safeRedirect } from "@/lib/clerk-errors";
import { AuthHeader, FormError, LegalNotice } from "../../_components/auth-parts";

/**
 * /sign-up/continue: reached from the SSO callback when a Google sign-up
 * still needs the terms accepted. Sign-up itself lives in the shared
 * AuthForm (/sign-in and /sign-up both render it).
 */
export function SignUpContinue() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirect_url"), "/onboarding");
  const [formError, setFormError] = useState<string | null>(null);

  const busy = fetchStatus === "fetching";
  const error = formError ?? globalErrorMessage(errors);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const { error: updateError } = await signUp.update({ legalAccepted: true });
    if (updateError) return;
    if (signUp.status !== "complete") {
      setFormError("We couldn't finish creating your account. Try again or contact support.");
      return;
    }
    const { error: finalizeError } = await signUp.finalize({
      navigate: async ({ decorateUrl }) => {
        const url = decorateUrl(redirectTo);
        if (url.startsWith("http")) window.location.href = url;
        else router.push(url);
      },
    });
    if (finalizeError) setFormError(clerkErrorMessage(finalizeError));
  };

  return (
    <div className="space-y-6">
      <AuthHeader
        title="Finish creating your account"
        description="One more step and you're in."
      />
      <form className="space-y-5" onSubmit={submit}>
        <FormError message={error} />
        <div id="clerk-captcha" className="empty:hidden" />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? <Spinner /> : null}
          Create account
        </Button>
        <LegalNotice action="creating an account" />
      </form>
    </div>
  );
}
