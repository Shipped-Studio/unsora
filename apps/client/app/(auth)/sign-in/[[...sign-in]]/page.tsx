import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Unsora to plan, schedule and publish posts across your social accounts.",
  alternates: { canonical: "/sign-in" },
};

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
