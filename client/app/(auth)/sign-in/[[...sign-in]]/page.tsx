"use client";

import { SignIn } from "@clerk/nextjs";
import { useClerkAppearance } from "../../_components/clerk-appearance";

export default function SignInPage() {
  const appearance = useClerkAppearance();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
          Welcome back
        </h2>
        <p className="text-sm text-muted-foreground">
          Sign in to keep building your next viral scene, character, or short
          film.
        </p>
      </div>

      <SignIn
        appearance={appearance}
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/"
      />
    </div>
  );
}
