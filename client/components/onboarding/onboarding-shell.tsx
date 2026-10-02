"use client";

import { UnsoraLogo } from "@/components/brand/unsora-logo";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";

interface OnboardingShellProps {
  currentStep: number;
  totalSteps: number;
  direction: "forward" | "back";
  canContinue: boolean;
  showBack: boolean;
  showSkip: boolean;
  hideNav: boolean;
  ctaLabel: string;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  children: React.ReactNode;
}

export function OnboardingShell({
  currentStep,
  totalSteps,
  direction,
  canContinue,
  showBack,
  showSkip,
  hideNav,
  ctaLabel,
  onNext,
  onBack,
  onSkip,
  children,
}: OnboardingShellProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        <UnsoraLogo variant="full" priority className="h-8" />

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-500 ease-out",
                  i <= currentStep ? "bg-primary" : "bg-muted",
                  i < currentStep
                    ? "w-4 sm:w-5"
                    : i === currentStep
                      ? "w-6 sm:w-8"
                      : "w-4 sm:w-5"
                )}
              />
            ))}
          </div>
          <span className="hidden text-xs font-medium text-muted-foreground sm:block">
            Step {currentStep + 1} of {totalSteps}
          </span>
        </div>
      </header>

      {/* Step content — scrollable */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          key={currentStep}
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            "animate-in fade-in animation-duration-300 fill-mode-both",
            direction === "forward"
              ? "slide-in-from-right-3"
              : "slide-in-from-left-3"
          )}
        >
          <div className="onboarding-scroll flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-5 pb-4 sm:px-8">
            {children}
          </div>
        </div>
      </div>

      {/* Bottom navigation */}
      {!hideNav && (
        <div className="shrink-0 border-t border-border/40 bg-gradient-to-t from-background via-background px-5 pb-5 pt-3 sm:px-8 sm:pb-7">
          <div className="mx-auto flex max-w-xl flex-col items-center gap-2.5">
            <div className="flex w-full items-center gap-3">
              {showBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.97]"
                >
                  <ArrowLeft size={16} weight="bold" />
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={onNext}
                disabled={!canContinue}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-all duration-200",
                  canContinue
                    ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98]"
                    : "cursor-not-allowed bg-primary/40 text-primary-foreground/60"
                )}
              >
                {ctaLabel}
                {currentStep === 0 && <ArrowRight size={16} weight="bold" />}
              </button>
            </div>
            {showSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Skip this step
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
