"use client";

import { useState } from "react";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { redirectToStripe } from "./redirect-to-stripe";

/**
 * Buying a credit pack: starts Stripe Checkout and tracks which pack's
 * checkout is being created. Shared by the Billing page and the pricing
 * dialog. Stripe brings the user back with `?topup=success|cancel`
 * (useTopupRedirect).
 */
export function useBuyCreditPack() {
  const { authFetch } = useAuthFetch();
  const [pendingPackKey, setPendingPackKey] = useState<string | null>(null);

  const buy = async (packKey: string) => {
    setPendingPackKey(packKey);
    const redirecting = await redirectToStripe(
      authFetch("/api/stripe/create-topup-session", {
        method: "POST",
        body: JSON.stringify({ packKey }),
      }),
      "Couldn't start checkout",
    );
    if (!redirecting) setPendingPackKey(null);
  };

  return { pendingPackKey, buy };
}
