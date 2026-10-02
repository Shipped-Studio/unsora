"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/**
 * Side-effect hook that handles the Stripe Checkout return URLs for one-time
 * credit top-ups (`?topup=success|cancel`) and plan switches
 * (`?upgrade=success|cancel`).
 *
 * We don't grant credits or cancel subscriptions here — the Stripe webhooks
 * do that server-side. This hook just:
 *   1. Surfaces a toast so the user knows the click worked.
 *   2. Refetches the usage query a few times because the webhook may land a
 *      moment after the redirect.
 *   3. Cleans the query string so a refresh doesn't replay the toast.
 */
export function useTopupRedirect(refetchUsage: () => void | Promise<unknown>) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const topup = searchParams.get("topup");
    if (!topup) return;

    if (topup === "success") {
      const purchased = Number(searchParams.get("credits") || 0);
      // The Stripe redirect is a full page load, so this effect can run
      // before <Toaster> (mounted after {children} in all-provider) has
      // subscribed — and sonner drops toasts fired with no listener. Defer
      // past the mount commit so the toast always lands.
      const t0 = setTimeout(() => {
        toast.success(
          purchased > 0
            ? `${purchased.toLocaleString()} credits added to your account`
            : "Payment successful — credits added to your account",
          { duration: 8000 },
        );
      }, 0);
      void refetchUsage();
      const t1 = setTimeout(() => void refetchUsage(), 2000);
      const t2 = setTimeout(() => void refetchUsage(), 6000);
      router.replace("/billing");
      return () => {
        clearTimeout(t0);
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    if (topup === "cancel") {
      const t = setTimeout(() => toast.info("Purchase cancelled"), 0);
      router.replace("/billing");
      return () => clearTimeout(t);
    }
  }, [searchParams, refetchUsage, router]);

  useEffect(() => {
    const upgrade = searchParams.get("upgrade");
    if (!upgrade) return;

    if (upgrade === "success") {
      // Same deferred-toast + staggered-refetch dance as top-ups: the
      // webhook that mints the new plan's credits (and cancels the old
      // subscription) may land a moment after this redirect.
      const t0 = setTimeout(() => {
        toast.success(
          "Plan updated! Your remaining credits were carried over.",
          { duration: 8000 },
        );
      }, 0);
      void refetchUsage();
      const t1 = setTimeout(() => void refetchUsage(), 2000);
      const t2 = setTimeout(() => void refetchUsage(), 6000);
      router.replace("/billing");
      return () => {
        clearTimeout(t0);
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    if (upgrade === "cancel") {
      const t = setTimeout(() => toast.info("Plan change cancelled"), 0);
      router.replace("/billing");
      return () => clearTimeout(t);
    }
  }, [searchParams, refetchUsage, router]);
}
