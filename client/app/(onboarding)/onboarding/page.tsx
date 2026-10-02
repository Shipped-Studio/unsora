"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { WelcomeStep } from "@/components/onboarding/steps/welcome-step";
import { ReferralSourceStep } from "@/components/onboarding/steps/referral-source-step";
import { RoleSelectionStep } from "@/components/onboarding/steps/role-selection-step";
import { ToolInterestsStep } from "@/components/onboarding/steps/tool-interests-step";
import { FeatureShowcaseStep } from "@/components/onboarding/steps/feature-showcase-step";
import { PlanSelectionStep } from "@/components/onboarding/steps/plan-selection-step";

const TOTAL_STEPS = 6;

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [referralSource, setReferralSource] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [toolInterests, setToolInterests] = useState<string[]>([]);

  const handleNext = useCallback(() => {
    if (currentStep >= TOTAL_STEPS - 1) {
      router.push("/");
      return;
    }
    setDirection("forward");
    setCurrentStep((prev) => prev + 1);
  }, [currentStep, router]);

  const handleBack = useCallback(() => {
    setDirection("back");
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleSkip = useCallback(() => {
    setDirection("forward");
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS - 1));
  }, []);

  const toggleRole = useCallback((roleId: string) => {
    setRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((r) => r !== roleId)
        : [...prev, roleId]
    );
  }, []);

  const toggleTool = useCallback((toolId: string) => {
    setToolInterests((prev) =>
      prev.includes(toolId)
        ? prev.filter((t) => t !== toolId)
        : [...prev, toolId]
    );
  }, []);

  const canContinue = (() => {
    switch (currentStep) {
      case 0:
        return true;
      case 1:
        return true;
      case 2:
        return roles.length > 0;
      case 3:
        return toolInterests.length > 0;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return true;
    }
  })();

  const handleComplete = useCallback(() => {
    router.push("/");
  }, [router]);

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <WelcomeStep />;
      case 1:
        return (
          <ReferralSourceStep
            selected={referralSource}
            onSelect={setReferralSource}
          />
        );
      case 2:
        return <RoleSelectionStep selected={roles} onToggle={toggleRole} />;
      case 3:
        return (
          <ToolInterestsStep
            selected={toolInterests}
            onToggle={toggleTool}
          />
        );
      case 4:
        return <FeatureShowcaseStep selectedTools={toolInterests} />;
      case 5:
        return (
          <PlanSelectionStep
            onBack={handleBack}
            onComplete={handleComplete}
          />
        );
      default:
        return null;
    }
  };

  return (
    <OnboardingShell
      currentStep={currentStep}
      totalSteps={TOTAL_STEPS}
      direction={direction}
      canContinue={canContinue}
      showBack={currentStep > 0 && currentStep < 5}
      showSkip={currentStep === 1}
      hideNav={currentStep === 5}
      ctaLabel={currentStep === 0 ? "Get Started" : "Continue"}
      onNext={handleNext}
      onBack={handleBack}
      onSkip={handleSkip}
    >
      {renderStep()}
    </OnboardingShell>
  );
}
