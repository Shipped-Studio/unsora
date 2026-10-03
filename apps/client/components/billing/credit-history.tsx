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

function formatAmount(amount: number) {
  return `${amount > 0 ? "+" : amount < 0 ? "−" : ""}${Math.abs(amount).toLocaleString()}`;
}

function amountClass(amount: number) {
  return cn("font-medium tabular-nums", amount > 0 ? "text-success" : "text-foreground");
}

function AmountCell({ amount }: { amount: number }) {
  return (
    <TableCell className={cn("px-4 text-right", amountClass(amount))}>
      {formatAmount(amount)}
    </TableCell>
  );
}

/** Below sm: two-line rows instead of a table that scrolls sideways. */
function MobileRows({
  transactions,
  loading,
}: {
  transactions: CreditTransaction[] | null;
  loading: boolean;
}) {
  return (
    <ul className="divide-y divide-card sm:hidden">
      {loading || !transactions
        ? Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-4 w-12" />
            </li>
          ))
        : transactions.map((tx) => (
            <li key={tx.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{tx.label}</p>
                <p className="truncate text-xs text-muted-foreground tabular-nums">
                  {formatWhen(tx.createdAt)} · {sourceLabel(tx)}
                </p>
              </div>
              <span className={cn("shrink-0 text-sm", amountClass(tx.amount))}>
                {formatAmount(tx.amount)}
              </span>
            </li>
          ))}
    </ul>
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
  const { data, isLoading, isError, refetch, isPlaceholderData } =
    useCreditTransactions(page, PAGE_SIZE);

  if (isError && !data) {
    return (
      <ErrorState
        title="Couldn't load credit history"
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
        <MobileRows transactions={data?.transactions ?? null} loading={isLoading} />
        <div className="max-sm:hidden">
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
                      <TableCell className="max-w-80 truncate px-4">
                        {tx.label}
                      </TableCell>
                      <TableCell className="max-w-44 truncate px-4 text-muted-foreground">
                        {sourceLabel(tx)}
                      </TableCell>
                      <AmountCell amount={tx.amount} />
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
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
