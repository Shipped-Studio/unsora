"use client";

import { useState } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import Next13ProgressBar from "next13-progressbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IconContext } from "@phosphor-icons/react";
import { Toaster } from "@/components/ui/sonner";
import { PricingProvider } from "@/contexts/pricing-context";

export default function AllProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // One client per browser session; creating it in render would reset the
  // cache on every re-render of the root.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delay={300}>
            <IconContext.Provider value={{ "aria-hidden": true }}>
              <PricingProvider>{children}</PricingProvider>
            </IconContext.Provider>
            <Next13ProgressBar
              height="2px"
              color="var(--primary)"
              options={{ showSpinner: false }}
              showOnShallow
            />
            <Toaster position="top-center" />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
