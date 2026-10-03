"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface GenerateButtonProps {
  credits?: number;
  /** Free-form cost shown instead of `credits`, e.g. "4 credits/min". */
  costLabel?: string;
  disabled?: boolean;
  onClick?: () => void;
  submitting?: boolean;
  submitState?: "idle" | "uploading" | "submitting";
  label?: string;
  className?: string;
}

/** The primary action on every tool composer: label plus the credit cost. */
export function GenerateButton({
  credits,
  costLabel,
  disabled,
  onClick,
  submitting,
  submitState,
  label = "Generate",
  className,
}: GenerateButtonProps) {
  const isUploading = submitState === "uploading";
  const isBusy =
    submitting || (submitState !== undefined && submitState !== "idle");

  return (
    <Button
      disabled={disabled || isBusy}
      onClick={onClick}
      className={cn("min-w-28", className)}
    >
      {isBusy ? (
        <>
          <Spinner />
          {isUploading ? "Uploading" : "Starting"}
        </>
      ) : (
        <>
          {label}
          {costLabel || credits !== undefined ? (
            <span className="font-normal tabular-nums opacity-70 group-disabled/button:opacity-100">
              {costLabel ?? `${credits} ${credits === 1 ? "credit" : "credits"}`}
            </span>
          ) : null}
        </>
      )}
    </Button>
  );
}
