import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Create an Unsora account to schedule posts across Instagram, TikTok, YouTube, LinkedIn and more.",
  // Collapses /sign-up?plan=... duplicates onto one URL.
  alternates: { canonical: "/sign-up" },
};

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
