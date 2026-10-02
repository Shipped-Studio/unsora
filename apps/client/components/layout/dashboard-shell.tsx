"use client";

import { AppNavProvider, AppRail, MobileNav } from "@/components/layout/app-rail";
import { CommandMenuProvider } from "@/components/layout/command-menu";
import { MusicPlayerProvider } from "@/contexts/music-player-context";

/**
 * Gray canvas with the icon rail on the left and every page inside one
 * rounded panel. The panel is the scroll container, so sticky headers and
 * composer docks stick to its edges.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AppNavProvider>
      <CommandMenuProvider>
        <div className="flex h-svh bg-background">
          <AppRail />
          <div className="min-w-0 flex-1 md:p-2">
            <main
              id="app-panel"
              className="relative flex h-full flex-col overflow-y-auto bg-card md:rounded-xl"
            >
              <MusicPlayerProvider>{children}</MusicPlayerProvider>
            </main>
          </div>
        </div>
        <MobileNav />
      </CommandMenuProvider>
    </AppNavProvider>
  );
}
