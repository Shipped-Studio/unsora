import { Suspense } from "react";
import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { AnalyticsView } from "@/components/scheduler/analytics-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader />
      <PageBody>
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
          <AnalyticsView />
        </Suspense>
      </PageBody>
    </>
  );
}
