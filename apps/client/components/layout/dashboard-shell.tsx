"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { AppNavProvider, AppRail, MobileNav, MobileTabBar, hasTabBar } from "@/components/layout/app-rail";
import { CommandMenuProvider } from "@/components/layout/command-menu";
import { MusicPlayerProvider } from "@/contexts/music-player-context";
import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog";
import { ProductTourProvider, TourAutoStart } from "@/components/onboarding/product-tour";
import { cn } from "@/lib/utils";

/**
 * Warm canvas with the sidebar on the left and every page inside one
 * rounded panel. The panel is the scroll container, so sticky headers and
 * composer docks stick to its edges. Phones get a bottom tab bar instead.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AppNavProvider>
      <ProductTourProvider>
        <CommandMenuProvider>
          <a
            href="#app-panel"
            className="sr-only rounded-lg bg-card px-3 py-2 text-sm font-medium shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
          >
            Skip to content
          </a>
          <div className="flex h-svh bg-sidebar">
            <AppRail />
            <div className="min-w-0 flex-1 md:py-2 md:pr-2">
              <main
                id="app-panel"
                tabIndex={-1}
                className={cn(
                  "relative flex h-full flex-col overflow-y-auto bg-card outline-none md:rounded-2xl md:border md:shadow-xs",
                  hasTabBar(pathname) && "pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0",
                )}
              >
                <MusicPlayerProvider>{children}</MusicPlayerProvider>
              </main>
            </div>
          </div>
          <MobileNav />
          <MobileTabBar />
          {/* Both read ?onboarding= from the URL, so they need a Suspense boundary. */}
          <Suspense fallback={null}>
            <OnboardingDialog />
            <TourAutoStart />
          </Suspense>
        </CommandMenuProvider>
      </ProductTourProvider>
    </AppNavProvider>
  );
}
