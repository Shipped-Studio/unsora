"use client";

import { Suspense } from "react";
import { AppNavProvider, AppRail, MobileNav } from "@/components/layout/app-rail";
import { CommandMenuProvider } from "@/components/layout/command-menu";
import { MusicPlayerProvider } from "@/contexts/music-player-context";
import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog";

/**
 * Gray canvas with the icon rail on the left and every page inside one
 * rounded panel. The panel is the scroll container, so sticky headers and
 * composer docks stick to its edges.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AppNavProvider>
      <CommandMenuProvider>
        <a
          href="#app-panel"
          className="sr-only rounded-lg bg-card px-3 py-2 text-sm font-medium shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        >
          Skip to content
        </a>
        <div className="flex h-svh bg-background">
          <AppRail />
          <div className="min-w-0 flex-1 md:p-2">
            <main
              id="app-panel"
              tabIndex={-1}
              className="relative flex h-full flex-col overflow-y-auto bg-card outline-none md:rounded-xl"
            >
              <MusicPlayerProvider>{children}</MusicPlayerProvider>
            </main>
          </div>
        </div>
        <MobileNav />
        {/* Reads ?onboarding= from the URL, so it needs a Suspense boundary. */}
        <Suspense fallback={null}>
          <OnboardingDialog />
        </Suspense>
      </CommandMenuProvider>
    </AppNavProvider>
  );
}
