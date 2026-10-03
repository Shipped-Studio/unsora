"use client";

import type { ReactNode } from "react";
import type { Icon } from "@phosphor-icons/react";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Bordered card around a `Table`. From `md` up the table keeps a minimum
 * width and scrolls sideways; below that, pages hide low-priority columns
 * (`hidden md:table-cell`) and fold their info into a second line instead.
 */
export function TableShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-xl bg-muted", className)}
    >
      <Table className="md:min-w-160">{children}</Table>
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
    <TableHead
      className={cn(
        "h-9 px-4 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
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
    <TableCell colSpan={colSpan} className={cn("h-11 px-4 py-2.5", className)}>
      {children}
    </TableCell>
  );
}

/**
 * Placeholder rows shaped like the table they stand in for. `mobileHidden`
 * lists the column indexes the real table hides below `md`.
 */
export function SkeletonRows({
  rows = 8,
  cols,
  mobileHidden = [],
}: {
  rows?: number;
  cols: number;
  mobileHidden?: number[];
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r} className="hover:bg-transparent">
          {Array.from({ length: cols }).map((__, c) => (
            <Td
              key={c}
              className={cn(mobileHidden.includes(c) && "hidden md:table-cell")}
            >
              <Skeleton className={cn("h-4", c === 0 ? "w-40" : "w-16")} />
            </Td>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/**
 * A single full-width row for "nothing matches" inside a table body, styled
 * like the shared EmptyState (inline variant, no frame).
 */
export function EmptyRow({
  cols,
  title,
  description,
  icon,
}: {
  cols: number;
  title: string;
  description?: ReactNode;
  icon?: Icon;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <Td colSpan={cols} className="p-0 whitespace-normal">
        <EmptyState
          variant="inline"
          icon={icon}
          title={title}
          description={description}
        />
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
  // A single page needs no pager.
  if (totalPages <= 1) return null;
  return (
    <div
      className={cn("flex items-center justify-between gap-3", className)}
    >
      <span className="text-xs text-muted-foreground tabular-nums">
        Page {page} of {totalPages}
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
