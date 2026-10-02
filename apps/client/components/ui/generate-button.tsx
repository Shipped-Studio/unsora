"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface GenerateButtonProps {
  credits?: number;
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
          {credits !== undefined ? (
            <span className="font-normal tabular-nums opacity-70">
              {credits} {credits === 1 ? "credit" : "credits"}
            </span>
          ) : null}
        </>
      )}
    </Button>
  );
}
