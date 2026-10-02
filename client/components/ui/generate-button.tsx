"use client";

import { Lightning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface GenerateButtonProps {
  credits?: number;
  disabled?: boolean;
  onClick?: () => void;
  submitting?: boolean;
  submitState?: "idle" | "uploading" | "submitting";
  label?: string;
  className?: string;
}

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
  const isSubmitting =
    submitting || (submitState !== undefined && submitState !== "idle");

  const button = (
    <Button
      disabled={disabled || isSubmitting}
      onClick={onClick}
      variant="brand"
      className={className}
    >
      {isSubmitting ? (
        <>
          <Spinner />
          {isUploading ? "Uploading..." : "Generating..."}
        </>
      ) : (
        <>
          {label}
          {credits !== undefined && (
            <span className="ml-1.5 flex items-center gap-1 text-[10px]">
              {credits} <Lightning className="size-3" />
            </span>
          )}
        </>
      )}
    </Button>
  );

  if (credits !== undefined && !isSubmitting) {
    return (
      <Tooltip>
        <TooltipTrigger>{button}</TooltipTrigger>
        <TooltipContent>
          <Lightning className="size-3" weight="fill" />
          Costs {credits} credits
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
