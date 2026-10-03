import { redirect } from "next/navigation";

/**
 * Sign-up lands here. Onboarding is a modal over the app now
 * (components/onboarding/onboarding-dialog.tsx), opened by ?onboarding=.
 */
export default function OnboardingPage() {
  redirect("/?onboarding=channels");
}
