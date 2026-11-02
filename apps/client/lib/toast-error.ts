import { toast } from "sonner";
import { ApiError } from "@/hooks/use-api";

/** Fired to open the pricing dialog from code that has no React context (hooks' onError). */
export const OPEN_PRICING_EVENT = "unsora:open-pricing";

export function openPricingDialog() {
  window.dispatchEvent(new Event(OPEN_PRICING_EVENT));
}

/** Fired to take the user to the credit packs on the billing page. */
export const BUY_CREDITS_EVENT = "unsora:buy-credits";

export function openCreditPacks() {
  window.dispatchEvent(new Event(BUY_CREDITS_EVENT));
}

/** The server's "Insufficient credits. Need 5, have 0", with or without a prefix. */
export function isCreditsError(message?: string | null) {
  return /insufficient credits/i.test(message ?? "");
}

/**
 * Shows why a request failed. When it failed for lack of credits, it says
 * what credits are for and offers the packs, instead of "Need 5, have 0".
 */
export function toastError(message: string) {
  if (!isCreditsError(message)) {
    toast.error(message);
    return;
  }
  const needed = /needs? ([\d,]+)/i.exec(message)?.[1];
  toast.error("Not enough credits", {
    id: "not-enough-credits",
    description: needed
      ? `AI tools run on credit packs. This one needs ${needed} ${needed === "1" ? "credit" : "credits"}.`
      : "AI tools run on credit packs.",
    action: { label: "Buy credits", onClick: openCreditPacks },
  });
}

/**
 * "Couldn't delete the post" with the server's reason underneath. When the
 * server says the plan doesn't cover it, the toast offers the plans instead
 * of leaving the user at a dead end; out of credits, it offers the packs.
 */
export function toastApiError(title: string, error: unknown) {
  const message = error instanceof Error ? error.message : undefined;
  if (message && isCreditsError(message)) return toastError(message);
  const planRequired = error instanceof ApiError && (error.code === "PLAN_REQUIRED" || error.status === 402);
  toast.error(title, {
    description: message && message !== title ? message : undefined,
    action: planRequired ? { label: "See plans", onClick: openPricingDialog } : undefined,
  });
}
