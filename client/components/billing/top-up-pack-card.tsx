"use client";

import { Plus, Sparkle } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { CreditPack } from "@/hooks/use-credit-packs";

interface TopUpPackCardProps {
  pack: CreditPack;
  /** True when this specific pack is mid-checkout. */
  isLoading: boolean;
  /** True when ANY pack is mid-checkout — used to disable other Buy buttons. */
  anyLoading: boolean;
  onBuy: (packKey: string) => void;
}

/**
 * Single one-time credit pack. Pricing/credits come straight from the server
 * (`/api/stripe/credit-packs`) so users can't tamper with the price by
 * editing client state.
 *
 * Built on the `size="sm"` variant of the project `Card` primitive. The
 * "Best Value" badge is positioned outside the card edge, so we override
 * Card's default `overflow-hidden` with `!overflow-visible` on popular
 * packs only.
 */
export function TopUpPackCard({
  pack,
  isLoading,
  anyLoading,
  onBuy,
}: TopUpPackCardProps) {
  const perCredit = pack.priceUsd / pack.credits;

  return (
    <Card
      size="sm"
      className={cn(
        "relative",
        pack.popular && "!overflow-visible ring-primary",
      )}
    >
      {pack.popular && (
        <Badge className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 text-[10px]">
          Best Value
        </Badge>
      )}

      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <Sparkle weight="fill" className="size-4 text-primary" />
          </span>
          {pack.name}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums">
            {pack.credits.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">credits</span>
        </div>

        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-lg font-semibold">${pack.priceUsd}</span>
          <span className="text-[11px] text-muted-foreground">
            · ${perCredit.toFixed(3)}/credit
          </span>
        </div>

        {pack.description && (
          <p className="mt-3 text-xs text-muted-foreground">
            {pack.description}
          </p>
        )}
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          size="sm"
          variant={pack.popular ? "default" : "outline"}
          disabled={anyLoading}
          onClick={() => onBuy(pack.key)}
        >
          {isLoading ? (
            <Spinner />
          ) : (
            <>
              <Plus weight="bold" className="size-3.5" />
              Buy
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
