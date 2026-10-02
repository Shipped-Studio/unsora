"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { PricingDialog } from "@/components/pricing-dialog";

interface PricingContextValue {
  openPricing: () => void;
  closePricing: () => void;
  isOpen: boolean;
}

const PricingContext = createContext<PricingContextValue | null>(null);

export function PricingProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openPricing = useCallback(() => setIsOpen(true), []);
  const closePricing = useCallback(() => setIsOpen(false), []);

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
