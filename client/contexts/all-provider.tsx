"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PricingProvider } from "@/contexts/pricing-context";
import { AssetsProvider } from "@/contexts/assets-context";
import Next13ProgressBar from "next13-progressbar";
import { Toaster } from "@/components/ui/sonner";

const queryClient = new QueryClient();

export default function AllProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
        >
          <TooltipProvider>
            <PricingProvider>
              <AssetsProvider>{children}</AssetsProvider>
            </PricingProvider>
            <Next13ProgressBar
              height="2px"
              color="var(--accent)"
              options={{ showSpinner: true }}
              showOnShallow
            />
            <Toaster position="top-right" closeButton />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
