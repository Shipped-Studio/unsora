"use client";

import { EmptyState, ErrorState } from "@/components/shared/states";
import type { CreditPack } from "@/hooks/use-credit-packs";
import { formatUsd } from "./format";
import { CardGridSkeleton, PackCard, cardGridClass, cardItemClass } from "./pricing-cards";

interface CreditPacksProps {
  packs: CreditPack[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Key of the pack whose checkout is being created. */
  pendingPackKey: string | null;
  onBuy: (packKey: string) => void;
}

/** The pack with the lowest price per credit, when there's a real choice. */
function bestValueKey(packs: CreditPack[]): string | null {
  const priced = packs.filter((pack) => pack.credits > 0);
  if (priced.length < 2) return null;
  const best = priced.reduce((a, b) =>
    b.priceUsd / b.credits < a.priceUsd / a.credits ? b : a,
  );
  return best.key;
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
    return <ErrorState title="Couldn't load credit packs" onRetry={onRetry} />;
  }

  if (!packs?.length) {
    return <EmptyState title="No credit packs right now" description="Check back later." />;
  }

  // The pack marked popular at /admin/pricing, as in onboarding; without one,
  // the best value.
  const popularKey = packs.find((pack) => pack.popular)?.key ?? null;
  const highlightKey = popularKey ?? bestValueKey(packs);

  return (
    <ul className={cardGridClass(packs.length)}>
      {packs.map((pack) => {
        const highlight = pack.key === highlightKey;
        return (
          <li key={pack.key} className={cardItemClass(packs.length)}>
            <PackCard
              pack={pack}
              highlight={highlight}
              badge={highlight ? (popularKey ? "Popular" : "Best value") : undefined}
              showPerCredit
              action={{
                label: `Buy for ${formatUsd(pack.priceUsd)}`,
                onClick: () => onBuy(pack.key),
                pending: pendingPackKey === pack.key,
                disabled: pendingPackKey !== null,
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}

export function CreditPacksSkeleton() {
  return <CardGridSkeleton />;
}
