"use client";

import { cn } from "@/lib/utils";
import { PLANS } from "@/constant/onboarding";
import {
  Check,
  Star,
  Lightning,
  ArrowLeft,
  ArrowRight,
} from "@phosphor-icons/react";

interface PlanSelectionStepProps {
  onBack: () => void;
  onComplete: () => void;
}

export function PlanSelectionStep({
  onBack,
  onComplete,
}: PlanSelectionStepProps) {
  return (
    <div className="flex w-full max-w-3xl flex-1 flex-col items-center py-4 sm:py-8">
      <h1 className="mb-2 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Upgrade Your Plan
      </h1>
      <p className="mb-8 text-center text-sm text-muted-foreground sm:text-base">
        Choose the plan that works best for your creative needs
      </p>

      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
        {PLANS.map((plan, i) => (
          <div
            key={plan.id}
            style={
              {
                "--tw-animation-delay": `${i * 100}ms`,
              } as React.CSSProperties
            }
            className={cn(
              "animate-in fade-in slide-in-from-bottom-3 fill-mode-both",
              "relative flex flex-col rounded-2xl border bg-card p-6 transition-shadow duration-300",
              plan.popular
                ? "border-primary ring-1 ring-primary shadow-md"
                : "border-border hover:shadow-md"
            )}
          >
            {plan.popular && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
                  <Star size={12} weight="fill" />
                  Most Popular
                </span>
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
              <p className="text-sm text-muted-foreground">{plan.description}</p>
            </div>

            <div className="mb-1">
              <span className="text-4xl font-bold tracking-tight text-foreground">
                ${plan.price}
              </span>
              <span className="text-sm text-muted-foreground">/mo</span>
            </div>

            <p className="mb-5 flex items-center gap-1 text-xs text-muted-foreground">
              <Lightning
                size={12}
                weight="fill"
                className="text-primary"
              />
              {plan.credits.toLocaleString()} credits/month
            </p>

            <button
              type="button"
              className={cn(
                "mb-5 w-full rounded-full py-2.5 text-sm font-semibold transition-all duration-200",
                plan.ctaStyle === "filled"
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md active:scale-[0.98]"
                  : "border border-border bg-background text-foreground hover:bg-muted"
              )}
            >
              {plan.cta}
            </button>

            <ul className="space-y-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check
                    size={16}
                    weight="bold"
                    className="mt-0.5 shrink-0 text-primary"
                  />
                  <span className="text-sm text-muted-foreground">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Cancel anytime · No hidden fees · 7-day money-back guarantee
      </p>

      <div className="mt-6 flex w-full max-w-xl items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.97]"
        >
          <ArrowLeft size={16} weight="bold" />
          Back
        </button>
        <button
          type="button"
          onClick={onComplete}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 active:scale-[0.98]"
        >
          Continue to Dashboard
          <ArrowRight size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}
