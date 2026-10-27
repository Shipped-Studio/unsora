import { toast } from "sonner";
import { ApiError } from "@/hooks/use-api";

/** Fired to open the pricing dialog from code that has no React context (hooks' onError). */
export const OPEN_PRICING_EVENT = "unsora:open-pricing";

export function openPricingDialog() {
  window.dispatchEvent(new Event(OPEN_PRICING_EVENT));
}

/**
 * "Couldn't delete the post" with the server's reason underneath. When the
 * server says the plan doesn't cover it, the toast offers the plans instead
 * of leaving the user at a dead end.
 */
export function toastApiError(title: string, error: unknown) {
  const planRequired = error instanceof ApiError && (error.code === "PLAN_REQUIRED" || error.status === 402);
  const message = error instanceof Error ? error.message : undefined;
  toast.error(title, {
    description: message && message !== title ? message : undefined,
    action: planRequired ? { label: "See plans", onClick: openPricingDialog } : undefined,
  });
}
