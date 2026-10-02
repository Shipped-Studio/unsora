"use client";

import { Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

interface TopUpSectionProps {
  /** Opens the `TopUpDialog` with the pack options. */
  onBuyCreditsClick: () => void;
}

/**
 * "Buy extra credits" section — just the entry point. The pack options live
 * in `TopUpDialog`; the page decides whether to render this at all (only
 * paid subscribers — the server enforces the same rule in
 * `createTopupCheckoutSession`).
 */
export function TopUpSection({ onBuyCreditsClick }: TopUpSectionProps) {
  return (
    <div className="mb-8 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div>
        <h2 className="text-lg font-semibold">Buy extra credits</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          One-time top-up. Credits never expire and are used after your
          subscription credits run out.
        </p>
      </div>
      <Button size="sm" onClick={onBuyCreditsClick} className="sm:shrink-0">
        <Plus weight="bold" className="size-3.5" />
        Buy Credits
      </Button>
    </div>
  );
}
