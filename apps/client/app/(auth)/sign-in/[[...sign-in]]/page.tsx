import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "../../_components/auth-form";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Unsora to plan, schedule and publish posts across your social accounts.",
  alternates: { canonical: "/sign-in" },
};

export default function SignInPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
