import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { BillingContent } from "@/components/billing/billing-content";
import { BillingSkeleton } from "@/components/billing/billing-skeleton";

export const metadata: Metadata = { title: "Billing" };

export default function BillingPage() {
  return (
    <>
      <PageHeader
        title="Billing"
        description="Your plan, credits and credit history"
      />
      <PageBody>
        {/* useSearchParams (in useTopupRedirect) needs a Suspense boundary. */}
        <Suspense fallback={<BillingSkeleton />}>
          <BillingContent />
        </Suspense>
      </PageBody>
    </>
  );
}
