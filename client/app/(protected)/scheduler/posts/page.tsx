import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { NotePencil } from "@phosphor-icons/react/dist/ssr";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { PublishTabs } from "@/components/scheduler/publish-tabs";
import { PostsTable } from "@/components/scheduler/posts-table";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Posts" };

export default function PostsPage() {
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
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
          <PostsTable />
        </Suspense>
      </PageBody>
    </>
  );
}
