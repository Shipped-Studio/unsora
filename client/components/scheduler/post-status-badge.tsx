import { STATUS_META } from "@/lib/scheduler/status";
import type { PostStatus } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";

const TONE_DOT = {
  neutral: "bg-muted-foreground/50",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
} as const;

/** Status as a small dot and label. */
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
        "inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          TONE_DOT[meta.tone],
          status === "PUBLISHING" && "animate-pulse",
        )}
      />
      {meta.label}
    </span>
  );
}
