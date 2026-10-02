"use client";

import Link from "next/link";
import { use } from "react";
import { Composer } from "@/components/composer/composer";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePost } from "@/hooks/use-posts";
import { formatForPost } from "@/lib/scheduler/formats";
import { canEdit } from "@/lib/scheduler/status";

export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: post, isLoading, error, refetch } = usePost(id);

  if (isLoading) {
    return (
      <>
        <PageHeader parents={[{ label: "Posts", href: "/scheduler/posts" }]} title="Edit post" />
        <PageBody className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </PageBody>
      </>
    );
  }

  if (error || !post) {
    return (
      <>
        <PageHeader parents={[{ label: "Posts", href: "/scheduler/posts" }]} title="Edit post" />
        <PageBody width="narrow">
          <ErrorState
            title="Couldn't load this post"
            description={error?.message}
            onRetry={() => void refetch()}
          />
        </PageBody>
      </>
    );
  }

  if (!canEdit(post.status)) {
    return (
      <>
        <PageHeader parents={[{ label: "Posts", href: "/scheduler/posts" }]} title="Edit post" />
        <PageBody width="narrow">
          <div className="space-y-4 rounded-lg bg-muted p-6">
            <p className="text-sm text-muted-foreground">
              {post.status === "PUBLISHING"
                ? "This post is publishing right now. You can edit it again if any account fails."
                : "Published posts can't be edited. Duplicate it to make a new version."}
            </p>
            <Link href={`/scheduler/posts/${post.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Back to post
            </Link>
          </div>
        </PageBody>
      </>
    );
  }

  return <Composer key={post.id} initialFormat={formatForPost(post)} post={post} />;
}
