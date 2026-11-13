"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { PricingDialog, type PricingTab } from "@/components/pricing-dialog";
import { hasCreditPlan, useUserUsage } from "@/hooks/use-user-usage";
import {
  BILLING_TAB_EVENT,
  BUY_CREDITS_EVENT,
  OPEN_BILLING_EVENT,
  OPEN_PRICING_EVENT,
} from "@/lib/toast-error";

interface PricingContextValue {
  /** Opens the pricing dialog on the Subscription tab. */
  openPricing: () => void;
  /** Opens the pricing dialog on the One-time packs tab. */
  openCredits: () => void;
  /** Opens the pricing dialog on the Monthly credits tab. */
  openMonthlyCredits: () => void;
  closePricing: () => void;
  isOpen: boolean;
}

const PricingContext = createContext<PricingContextValue | null>(null);

export function PricingProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<PricingTab>("plans");
  const router = useRouter();
  const pathname = usePathname();
  const { usage } = useUserUsage();
  const subscribedToCredits = hasCreditPlan(usage);

  const openOn = useCallback((which: PricingTab) => {
    setTab(which);
    setIsOpen(true);
  }, []);
  const openPricing = useCallback(() => openOn("plans"), [openOn]);
  const openCredits = useCallback(() => openOn("credits"), [openOn]);
  const openMonthlyCredits = useCallback(() => openOn("monthly"), [openOn]);
  const closePricing = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    window.addEventListener(OPEN_PRICING_EVENT, openPricing);
    return () => window.removeEventListener(OPEN_PRICING_EVENT, openPricing);
  }, [openPricing]);

  // "Buy credits" (a toast, the sidebar): Monthly credits for someone
  // without them, a one-time pack (a top-up) for a subscriber who ran out.
  // On Billing, where both are on the page, its tab instead of the dialog.
  useEffect(() => {
    const buyCredits = () => {
      if (pathname === "/billing") {
        const tab = subscribedToCredits ? "credits" : "monthly";
        window.dispatchEvent(new CustomEvent(BILLING_TAB_EVENT, { detail: tab }));
      } else if (subscribedToCredits) {
        openCredits();
      } else {
        openMonthlyCredits();
      }
    };
    window.addEventListener(BUY_CREDITS_EVENT, buyCredits);
    return () => window.removeEventListener(BUY_CREDITS_EVENT, buyCredits);
  }, [pathname, openCredits, openMonthlyCredits, subscribedToCredits]);

  // "Update card" in a toast: the past-due banner on Billing has the button.
  useEffect(() => {
    const openBilling = () => {
      if (pathname === "/billing") window.scrollTo({ top: 0, behavior: "smooth" });
      else router.push("/billing");
    };
    window.addEventListener(OPEN_BILLING_EVENT, openBilling);
    return () => window.removeEventListener(OPEN_BILLING_EVENT, openBilling);
  }, [pathname, router]);

  return (
    <PricingContext.Provider
      value={{ openPricing, openCredits, openMonthlyCredits, closePricing, isOpen }}
    >
      {children}
      <PricingDialog open={isOpen} onOpenChange={setIsOpen} tab={tab} onTabChange={setTab} />
    </PricingContext.Provider>
  );
}

export function usePricing() {
  const context = useContext(PricingContext);
  if (!context) {
    throw new Error("usePricing must be used within a PricingProvider");
  }
  return context;
}
