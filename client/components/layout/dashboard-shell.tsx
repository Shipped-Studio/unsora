"use client";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/dashboard-sidebar";
import { MusicPlayerProvider } from "@/contexts/music-player-context";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <SidebarTrigger className="fixed left-3 top-3 z-50 border border-border bg-background shadow-sm md:hidden" />
        <MusicPlayerProvider>{children}</MusicPlayerProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
