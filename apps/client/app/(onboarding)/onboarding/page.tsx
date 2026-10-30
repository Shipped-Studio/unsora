import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { Spinner } from "@/components/ui/spinner";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = {
  title: "Get set up",
  robots: { index: false },
};

/** Accounts older than this skip onboarding even if they never finished it. */
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;

async function needsOnboarding(): Promise<boolean> {
  const user = await currentUser();
  if (!user || user.unsafeMetadata?.onboardedAt) return false;
  return Date.now() - user.createdAt < NEW_ACCOUNT_MS;
}

/**
 * Where sign-in and sign-up land when there's no redirect_url. New accounts
 * that haven't finished onboarding get it here (onboarding-flow.tsx);
 * everyone else goes straight to the app. A `?setup=` means the flow is under
 * way (or coming back from a channel's OAuth or Stripe), so it always shows.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const { setup } = await searchParams;
  if (!setup && !(await needsOnboarding())) redirect("/");

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        }
      >
        <OnboardingFlow />
      </Suspense>
    </div>
  );
}
