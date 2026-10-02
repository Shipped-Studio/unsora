"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState, ErrorState } from "@/components/shared/states";
import type { CreditPack } from "@/hooks/use-credit-packs";
import { cn } from "@/lib/utils";
import { formatUsd } from "./format";

interface CreditPacksProps {
  packs: CreditPack[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Key of the pack whose checkout is being created. */
  pendingPackKey: string | null;
  onBuy: (packKey: string) => void;
}

function gridCols(count: number) {
  if (count >= 4) return "sm:grid-cols-2 lg:grid-cols-4";
  if (count === 3) return "sm:grid-cols-3";
  return "sm:grid-cols-2";
}

export function CreditPacks({
  packs,
  loading,
  error,
  onRetry,
  pendingPackKey,
  onBuy,
}: CreditPacksProps) {
  if (loading) return <CreditPacksSkeleton />;

  if (error) {
    return (
      <ErrorState
        title="Couldn't load credit packs"
        description={error}
        onRetry={onRetry}
      />
    );
  }

  if (!packs?.length) {
    return (
      <EmptyState
        title="No credit packs right now"
        description="Check back later, or change your plan for more credits each period."
      />
    );
  }

  return (
    <div className={cn("grid gap-3", gridCols(packs.length))}>
      {packs.map((pack) => {
        const isPending = pendingPackKey === pack.key;
        const perCredit = pack.credits > 0 ? pack.priceUsd / pack.credits : 0;
        return (
          <Card key={pack.key} size="sm">
            <CardHeader>
              <CardTitle>{pack.name}</CardTitle>
              {pack.description ? (
                <CardDescription>{pack.description}</CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="flex-1 gap-1">
              <p className="text-2xl font-medium tabular-nums">
                {pack.credits.toLocaleString()}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  credits
                </span>
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                ${perCredit.toFixed(3)} per credit
              </p>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                disabled={pendingPackKey !== null}
                onClick={() => onBuy(pack.key)}
              >
                {isPending ? <Spinner data-icon="inline-start" /> : null}
                Buy for {formatUsd(pack.priceUsd)}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

export function CreditPacksSkeleton() {
  return (
    <div className={cn("grid gap-3", gridCols(4))}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} size="sm">
          <CardHeader>
            <Skeleton className="h-4 w-20" />
          </CardHeader>
          <CardContent className="gap-2">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-24" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-9 w-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
