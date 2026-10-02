"use client";

import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { ArrowRight, Check } from "@phosphor-icons/react";
import { useClerkAppearance } from "../../_components/clerk-appearance";

const PERKS = [
  "Free credits to try every tool",
  "Sora 2, Veo 3 & Kling 2 in one place",
  "Upscale, dub, and edit in your browser",
];

export default function SignUpPage() {
  const appearance = useClerkAppearance();

  return (
    <div className="space-y-6">
      <SignUp
        appearance={appearance}
        signInUrl="/sign-in"
        fallbackRedirectUrl="/"
      />
    </div>
  );
}
