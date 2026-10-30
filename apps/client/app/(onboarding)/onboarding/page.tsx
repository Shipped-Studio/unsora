import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";

/** Accounts older than this skip onboarding even if they never finished it. */
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;

/**
 * Where sign-in and sign-up land when there's no redirect_url. Onboarding is
 * a modal over the app (components/onboarding/onboarding-dialog.tsx), opened
 * by ?onboarding=, and only new accounts that haven't finished it see it;
 * everyone else goes straight to the app.
 */
export default async function OnboardingPage() {
  const user = await currentUser();
  const onboarded = Boolean(user?.unsafeMetadata?.onboardedAt);
  const isNew = user ? Date.now() - user.createdAt < NEW_ACCOUNT_MS : false;
  redirect(!onboarded && isNew ? "/?onboarding=channels" : "/");
}
