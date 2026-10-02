"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Bordered card around a `Table`. The table scrolls sideways on its own. */
export function TableShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl bg-muted", className)}>
      <Table className="min-w-160">{children}</Table>
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
    <TableHead className={cn("px-4 text-xs text-muted-foreground", className)}>
      {children}
    </TableHead>
  );
}

export function Td({
  children,
  className,
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <TableCell colSpan={colSpan} className={cn("px-4 py-2.5", className)}>
      {children}
    </TableCell>
  );
}

/** Placeholder rows shaped like the table they stand in for. */
export function SkeletonRows({ rows = 8, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r} className="hover:bg-transparent">
          {Array.from({ length: cols }).map((__, c) => (
            <Td key={c}>
              <Skeleton className={cn("h-4", c === 0 ? "w-40" : "w-16")} />
            </Td>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** A single full-width row for "nothing matches" inside a table body. */
export function EmptyRow({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <TableRow className="hover:bg-transparent">
      <Td colSpan={cols} className="py-10 text-center text-sm text-muted-foreground">
        {children}
      </Td>
    </TableRow>
  );
}

/** Previous / next pager with page context. */
export function Pager({
  page,
  totalPages,
  total,
  onPage,
  disabled,
  className,
}: {
  page: number;
  totalPages: number;
  total?: number;
  onPage: (p: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3", className)}
    >
      <span className="text-xs text-muted-foreground tabular-nums">
        Page {page} of {Math.max(totalPages, 1)}
        {typeof total === "number" ? ` · ${total.toLocaleString()} total` : ""}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPage(page - 1)}
          disabled={disabled || page <= 1}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPage(page + 1)}
          disabled={disabled || page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
