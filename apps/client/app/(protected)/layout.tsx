import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { mustFinishOnboarding } from "@/components/onboarding/setup";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // New accounts finish onboarding (which starts their plan) before the app.
  // Runs when the app is entered; onboarding's last step marks them done.
  const user = await currentUser();
  if (user && mustFinishOnboarding(user)) redirect("/onboarding");

  return <DashboardShell>{children}</DashboardShell>;
}
