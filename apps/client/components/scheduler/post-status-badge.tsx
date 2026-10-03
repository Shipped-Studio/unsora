import { STATUS_META } from "@/lib/scheduler/status";
import type { PostStatus } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";

const TONE_PILL = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-info-subtle text-info",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-destructive-subtle text-destructive",
} as const;

/** Status as a soft, tinted pill. */
export function PostStatusBadge({
  status,
  className,
}: {
  status: PostStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap",
        TONE_PILL[meta.tone],
        status === "PUBLISHING" && "animate-pulse",
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
