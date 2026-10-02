"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export async function copyText(value: string, message = "Copied") {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(message);
    return true;
  } catch {
    toast.error("Couldn't copy. Select the text and copy it manually.");
    return false;
  }
}

interface CopyButtonProps {
  value: string;
  /** Accessible name, and the visible text when `showLabel` is set. */
  label?: string;
  showLabel?: boolean;
  /** Toast shown after copying. */
  message?: string;
  variant?: "ghost" | "outline" | "secondary" | "default";
  size?: "xs" | "sm" | "default" | "icon-xs" | "icon-sm" | "icon";
  className?: string;
}

/** Copies `value` to the clipboard and confirms with a toast. */
export function CopyButton({
  value,
  label = "Copy",
  showLabel = false,
  message = "Copied",
  variant = "ghost",
  size,
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const Icon = copied ? Check : Copy;

  return (
    <Button
      type="button"
      variant={variant}
      size={size ?? (showLabel ? "sm" : "icon-sm")}
      aria-label={showLabel ? undefined : label}
      className={className}
      onClick={async () => {
        if (await copyText(value, message)) setCopied(true);
      }}
    >
      <Icon />
      {showLabel ? label : null}
    </Button>
  );
}
