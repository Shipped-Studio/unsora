import Link from "next/link";
import type { Metadata } from "next";
import { NotePencil } from "@phosphor-icons/react/dist/ssr";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { PublishTabs } from "@/components/scheduler/publish-tabs";
import { QueueView } from "@/components/scheduler/queue-view";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Queue" };

export default function QueuePage() {
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
      <PageBody>
        <QueueView />
      </PageBody>
    </>
  );
}
