import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
