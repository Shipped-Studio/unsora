"use client";

import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";

/**
 * Shared appearance config for Clerk's <SignIn /> and <SignUp /> so they
 * blend in with the rest of the app. We thread the active next-themes value
 * through so the form auto-flips between light + dark with the page.
 */
export function useClerkAppearance() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  return {
    baseTheme: isDark ? dark : undefined,
    variables: {
      colorPrimary: isDark ? "#e8ff6b" : "#7a9a20",
      colorTextOnPrimaryBackground: isDark ? "#0a0a0a" : "#ffffff",
      // Must be a real surface color, not "transparent": Clerk derives the
      // card/footer gradients from this via color-mix, and a transparent
      // input collapses them to solid black in light mode.
      colorBackground: isDark ? "#0a0a0a" : "#f7f7f4",
      colorText: isDark ? "#f0f0f0" : "#0a0a0a",
      colorTextSecondary: isDark ? "#a8a8a8" : "#6b6b6b",
      colorInputBackground: isDark
        ? "rgba(255,255,255,0.04)"
        : "rgba(0,0,0,0.02)",
      colorInputText: isDark ? "#f0f0f0" : "#0a0a0a",
      colorDanger: "#ef4444",
      colorSuccess: "#10b981",
      colorWarning: "#f59e0b",
      borderRadius: "0.75rem",
      fontFamily: "var(--font-dm-sans), ui-sans-serif, system-ui",
      fontSize: "0.95rem",
    },
    elements: {
      rootBox: "w-full",
      cardBox: "w-full shadow-none border-none bg-transparent",
      card: "w-full shadow-none border-none bg-transparent p-0",
      header: "hidden",
      headerTitle: "hidden",
      headerSubtitle: "hidden",
      socialButtonsBlockButton:
        "border border-border bg-background/40 hover:bg-accent transition-colors rounded-xl h-11 font-medium",
      socialButtonsBlockButtonText: "font-medium text-foreground",
      dividerLine: "bg-border",
      dividerText: "text-muted-foreground text-xs uppercase tracking-wider",
      formFieldLabel: "text-foreground/90 text-sm font-medium",
      formFieldInput:
        "border border-border bg-background/40 hover:border-foreground/30 focus:border-foreground rounded-xl h-11 text-foreground placeholder:text-muted-foreground/60",
      formButtonPrimary:
        "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors rounded-xl h-11 font-semibold tracking-tight shadow-none normal-case",
      // bg-none kills Clerk's footer gradient (background-image), which
      // bg-transparent alone does not touch.
      footer:
        "bg-transparent bg-none border-none [&>div]:bg-transparent [&>div]:bg-none",
      footerAction: "bg-transparent bg-none",
      footerActionText: "text-muted-foreground text-sm",
      footerActionLink:
        "text-foreground hover:text-foreground/80 font-semibold underline-offset-4 hover:underline",
      identityPreviewEditButton: "text-foreground hover:text-foreground/80",
      formFieldAction: "text-foreground hover:text-foreground/80",
      otpCodeFieldInput:
        "border border-border bg-background/40 rounded-xl text-foreground",
      formResendCodeLink: "text-foreground hover:text-foreground/80",
      alternativeMethodsBlockButton:
        "border border-border bg-background/40 hover:bg-accent rounded-xl",
    },
    layout: {
      socialButtonsPlacement: "top" as const,
      socialButtonsVariant: "blockButton" as const,
      showOptionalFields: true,
    },
  };
}
