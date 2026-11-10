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
import { PricingDialog } from "@/components/pricing-dialog";
import { BUY_CREDITS_EVENT, OPEN_BILLING_EVENT, OPEN_PRICING_EVENT } from "@/lib/toast-error";

interface PricingContextValue {
  openPricing: () => void;
  closePricing: () => void;
  isOpen: boolean;
}

const PricingContext = createContext<PricingContextValue | null>(null);

export function PricingProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const openPricing = useCallback(() => setIsOpen(true), []);
  const closePricing = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    window.addEventListener(OPEN_PRICING_EVENT, openPricing);
    return () => window.removeEventListener(OPEN_PRICING_EVENT, openPricing);
  }, [openPricing]);

  // "Buy credits" in a toast: go to the packs, or scroll to them when already there.
  useEffect(() => {
    const openPacks = () => {
      const packs = document.getElementById("credits");
      if (pathname === "/billing" && packs) {
        packs.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        router.push("/billing#credits");
      }
    };
    window.addEventListener(BUY_CREDITS_EVENT, openPacks);
    return () => window.removeEventListener(BUY_CREDITS_EVENT, openPacks);
  }, [pathname, router]);

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
    <PricingContext.Provider value={{ openPricing, closePricing, isOpen }}>
      {children}
      <PricingDialog open={isOpen} onOpenChange={setIsOpen} />
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
