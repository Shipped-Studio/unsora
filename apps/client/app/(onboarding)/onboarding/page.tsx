import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { UnsoraLogo } from "@/components/brand/unsora-logo";
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
 * everyone else goes straight to the app. A `?step=` means the flow is under
 * way (or coming back from a channel's OAuth or Stripe), so it always shows.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { step } = await searchParams;
  if (!step && !(await needsOnboarding())) redirect("/");

  return (
    <div className="flex min-h-svh flex-col bg-background px-4 py-6 sm:px-10">
      <Link href="/" className="inline-flex w-fit">
        <UnsoraLogo variant="full" priority className="h-7" />
      </Link>

      {/* Top-aligned so the stepper stays put as the steps change height. */}
      <main className="flex flex-1 justify-center pt-10 pb-12 sm:pt-14">
        <div className="w-full">
          <Suspense fallback={<Spinner className="mx-auto size-6 text-muted-foreground" />}>
            <OnboardingFlow />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
