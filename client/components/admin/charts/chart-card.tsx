"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function ChartCard({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card p-4 sm:p-5",
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h3 className="truncate text-sm font-semibold text-foreground">
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
