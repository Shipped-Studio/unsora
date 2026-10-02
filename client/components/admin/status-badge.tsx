"use client";

import { cn } from "@/lib/utils";

/**
 * Status pill for tasks. Color is backed by a text label (never color-alone),
 * and the palette matches the charts' status colors.
 */
export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const s = status.toUpperCase();
  const styles: Record<string, string> = {
    COMPLETED:
      "bg-[#0ca30c]/12 text-[#0a8a0a] dark:text-[#37c837] border-[#0ca30c]/20",
    FAILED:
      "bg-[#d03b3b]/12 text-[#c22e2e] dark:text-[#ec7676] border-[#d03b3b]/20",
    PROCESSING:
      "bg-[#2a78d6]/12 text-[#1f5fb0] dark:text-[#5c9ef0] border-[#2a78d6]/20",
    QUEUED:
      "bg-[#fab219]/15 text-[#a9740a] dark:text-[#f0b74a] border-[#fab219]/25",
  };
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-medium capitalize",
        styles[s] ?? "bg-muted text-muted-foreground border-border",
        className,
      )}
    >
      {s.toLowerCase()}
    </span>
  );
}
