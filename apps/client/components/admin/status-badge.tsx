import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "destructive" | "info" | "muted";

const DOT: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
  muted: "bg-muted-foreground/60",
};

/** A small colored dot plus a text label, so status is never color alone. */
export function StatusDot({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm whitespace-nowrap",
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])} />
      {children}
    </span>
  );
}

const TASK_TONES: Record<string, StatusTone> = {
  COMPLETED: "success",
  FAILED: "destructive",
  PROCESSING: "info",
  QUEUED: "warning",
};

/** Task status (COMPLETED, FAILED, PROCESSING, QUEUED). */
export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const s = status.toUpperCase();
  const label = s.charAt(0) + s.slice(1).toLowerCase();
  return (
    <StatusDot tone={TASK_TONES[s] ?? "muted"} className={className}>
      {label}
    </StatusDot>
  );
}
