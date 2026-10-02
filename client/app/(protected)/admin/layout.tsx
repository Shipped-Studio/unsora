"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldWarning } from "@phosphor-icons/react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { EmptyState, LoadingState } from "@/components/shared/states";
import { useIsAdmin } from "@/hooks/admin/use-admin-data";

/**
 * Client-side gate for /admin. It hides the UI from non-admins; the real
 * enforcement is the requireAdmin middleware on every /api/admin/* endpoint.
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

  if (loading || !isAdmin) {
    return (
      <>
        <PageHeader title="Admin" description={null} />
        <PageBody>
          {loading ? (
            <LoadingState />
          ) : (
            <EmptyState
              icon={ShieldWarning}
              title="Admin access required"
              description="This area is for Unsora admins. Taking you back to Home."
            />
          )}
        </PageBody>
      </>
    );
  }

  return children;
}
