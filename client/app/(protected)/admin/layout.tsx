"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldWarning } from "@phosphor-icons/react";
import { useIsAdmin } from "@/hooks/admin/use-admin-data";
import { AdminNav } from "@/components/admin/admin-nav";
import { Spinner } from "@/components/ui/spinner";

/**
 * Client-side gate for the whole /admin section. This hides the UI from
 * non-admins; the real enforcement is the requireAdmin middleware on every
 * /api/admin/* endpoint, so even a forced navigation returns no data.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin, loading } = useIsAdmin();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin) {
      const t = setTimeout(() => router.replace("/"), 1800);
      return () => clearTimeout(t);
    }
  }, [loading, isAdmin, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <ShieldWarning weight="fill" className="size-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Admin access required</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This area is restricted. Redirecting you to the dashboard…
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
      <AdminNav />
      {children}
    </div>
  );
}
