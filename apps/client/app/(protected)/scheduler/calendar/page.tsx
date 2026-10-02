import Link from "next/link";
import { Suspense } from "react";
import { NotePencil } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { CalendarView } from "@/components/calendar/calendar-view";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { PublishTabs } from "@/components/scheduler/publish-tabs";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <>
      <PageHeader
        tabs={<PublishTabs />}
        actions={
          <Link href="/scheduler/new" className={buttonVariants()}>
            <NotePencil />
            New post
          </Link>
        }
      />
      <PageBody width="full">
        <Suspense fallback={<Skeleton className="h-[36rem] w-full rounded-lg" />}>
          <CalendarView />
        </Suspense>
      </PageBody>
    </>
  );
}
