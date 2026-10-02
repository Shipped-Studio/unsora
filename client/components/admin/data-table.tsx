"use client";

import { cn } from "@/lib/utils";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { ReactNode } from "react";

/** Horizontally-scrollable table shell (the page body never scrolls sideways). */
export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          {children}
        </table>
      </div>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "border-b border-border px-4 py-2.5 text-left text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>
  );
}

export function Tr({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-border/60 last:border-0 transition-colors",
        onClick && "cursor-pointer hover:bg-muted/50",
        className,
      )}
    >
      {children}
    </tr>
  );
}

/** Prev / next pager with page context. */
export function Pager({
  page,
  totalPages,
  total,
  onPage,
  className,
}: {
  page: number;
  totalPages: number;
  total?: number;
  onPage: (p: number) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-3 flex items-center justify-between gap-3 text-sm",
        className,
      )}
    >
      <span className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
        {typeof total === "number" && ` · ${total.toLocaleString()} total`}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
        >
          <CaretLeft className="size-4" />
        </button>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
        >
          <CaretRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
