import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "../../_components/auth-form";
import { SignUpContinue } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Create an Unsora account to schedule posts across Instagram, TikTok, YouTube, LinkedIn and more.",
  // Collapses /sign-up?plan=... duplicates onto one URL.
  alternates: { canonical: "/sign-up" },
};

/** Same email-first form as /sign-in; /sign-up/continue finishes a Google sign-up. */
export default async function SignUpPage({
  params,
}: {
  params: Promise<{ "sign-up"?: string[] }>;
}) {
  const { "sign-up": segments } = await params;
  return (
    <Suspense>{segments?.[0] === "continue" ? <SignUpContinue /> : <AuthForm />}</Suspense>
  );
}
