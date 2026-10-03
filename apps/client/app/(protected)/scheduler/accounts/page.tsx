import { Suspense } from "react";
import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { AccountsView } from "@/components/scheduler/accounts-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Accounts" };

export default function AccountsPage() {
  return (
    <>
      <PageHeader />
      <PageBody width="default">
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
          <AccountsView />
        </Suspense>
      </PageBody>
    </>
  );
}
