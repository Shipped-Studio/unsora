"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { CreditPack } from "@/hooks/use-credit-packs";
import { TopUpPackCard } from "./top-up-pack-card";

interface TopUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packs: CreditPack[] | null | undefined;
  loading: boolean;
  /** Key of the pack currently mid-checkout, or null. */
  loadingPackKey: string | null;
  onBuy: (packKey: string) => void;
}

/**
 * Credit top-up picker. Opened from the "Buy Credits" button in
 * `TopUpSection`; buying a pack redirects to Stripe Checkout, so the dialog
 * stays open (with the pack's button in a loading state) until the redirect
 * happens.
 */
export function TopUpDialog({
  open,
  onOpenChange,
  packs,
  loading,
  loadingPackKey,
  onBuy,
}: TopUpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <div>
          <DialogTitle>Buy extra credits</DialogTitle>
          <DialogDescription className="mt-1">
            One-time top-up. Credits never expire and are used after your
            subscription credits run out.
          </DialogDescription>
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center rounded-xl border">
            <Spinner className="size-5 text-muted-foreground" />
          </div>
        ) : !packs || packs.length === 0 ? (
          <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
            No credit packs available right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
            {packs.map((pack) => (
              <TopUpPackCard
                key={pack.key}
                pack={pack}
                isLoading={loadingPackKey === pack.key}
                anyLoading={loadingPackKey !== null}
                onBuy={onBuy}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
