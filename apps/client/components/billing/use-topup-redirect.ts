"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/**
 * Handles the Stripe Checkout return URLs for credit top-ups
 * (`?topup=success|cancel`) and plan switches (`?upgrade=success|cancel`).
 *
 * Credits are granted by the Stripe webhook, not here. This hook shows a
 * toast, refreshes billing data a few times (the webhook can land a moment
 * after the redirect), and strips the query string so a reload doesn't
 * replay the toast.
 */
export function useTopupRedirect(refresh: () => void) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const topup = searchParams.get("topup");
    const upgrade = searchParams.get("upgrade");
    if (!topup && !upgrade) return;

    // Handle each return once. The timers are deliberately not cleared:
    // stripping the query string re-runs this effect, and the delayed
    // refreshes still need to fire.
    const key = searchParams.toString();
    if (handled.current === key) return;
    handled.current = key;

    // The redirect is a full page load, so this can run before <Toaster>
    // subscribes, and sonner drops toasts with no listener. Defer past mount.
    if (topup === "success" || upgrade === "success") {
      const purchased = Number(searchParams.get("credits") || 0);
      const message =
        upgrade === "success"
          ? "Plan updated. Your remaining credits carried over."
          : purchased > 0
            ? `${purchased.toLocaleString()} credits added`
            : "Credits added";
      setTimeout(() => toast.success(message), 0);
      refresh();
      setTimeout(refresh, 2000);
      setTimeout(refresh, 6000);
    } else if (topup === "cancel") {
      setTimeout(() => toast.info("Checkout cancelled"), 0);
    } else if (upgrade === "cancel") {
      setTimeout(() => toast.info("Plan change cancelled"), 0);
    }

    router.replace("/billing");
  }, [searchParams, refresh, router]);
}
