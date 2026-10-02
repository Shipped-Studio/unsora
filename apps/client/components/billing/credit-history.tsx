"use client";

import { useState } from "react";
import { Receipt } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { cn } from "@/lib/utils";
import {
  useCreditTransactions,
  type CreditTransaction,
} from "./use-credit-transactions";

const PAGE_SIZE = 20;

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sourceLabel(tx: CreditTransaction) {
  if (tx.source === "api") return tx.apiKeyName ?? "API";
  return "Web";
}

function AmountCell({ amount }: { amount: number }) {
  const positive = amount > 0;
  return (
    <TableCell
      className={cn(
        "px-4 text-right font-medium tabular-nums",
        positive ? "text-success" : "text-foreground",
      )}
    >
      {positive ? "+" : amount < 0 ? "−" : ""}
      {Math.abs(amount).toLocaleString()}
    </TableCell>
  );
}

function HeaderRow() {
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead className="px-4 text-xs text-muted-foreground">Date</TableHead>
        <TableHead className="px-4 text-xs text-muted-foreground">
          Description
        </TableHead>
        <TableHead className="px-4 text-xs text-muted-foreground">Source</TableHead>
        <TableHead className="px-4 text-right text-xs text-muted-foreground">
          Amount
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

export function CreditHistory() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch, isPlaceholderData } =
    useCreditTransactions(page, PAGE_SIZE);

  if (isError && !data) {
    return (
      <ErrorState
        title="Couldn't load credit history"
        description={error.message}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!isLoading && data && data.pagination.total === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No credit activity yet"
        description="Credits you receive and spend, on the web or through the API, show up here."
      />
    );
  }

  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "overflow-hidden rounded-xl bg-muted transition-opacity",
          isPlaceholderData && "opacity-60",
        )}
      >
        <Table>
          <HeaderRow />
          <TableBody>
            {isLoading || !data
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    <TableCell className="px-4">
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell className="px-4">
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell className="px-4">
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell className="px-4">
                      <Skeleton className="ml-auto h-4 w-12" />
                    </TableCell>
                  </TableRow>
                ))
              : data.transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="px-4 text-muted-foreground tabular-nums">
                      {formatWhen(tx.createdAt)}
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate px-4">
                      {tx.label}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate px-4 text-muted-foreground">
                      {sourceLabel(tx)}
                    </TableCell>
                    <AmountCell amount={tx.amount} />
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {data && totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground tabular-nums">
            Page {data.pagination.page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isPlaceholderData}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isPlaceholderData}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
