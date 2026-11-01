"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy } from "@phosphor-icons/react";
import { Composer } from "@/components/composer/composer";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/shared/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { postQueryKeys, useDuplicatePost, usePost } from "@/hooks/use-posts";
import { formatForPost } from "@/lib/scheduler/formats";
import { canEdit } from "@/lib/scheduler/status";
import type { Post } from "@/lib/scheduler/types";

const parents = [{ label: "Posts", href: "/scheduler/posts" }];

/** Same grid as the composer, so nothing jumps when it loads. */
function ComposerSkeleton() {
  return (
    <div className="flex min-h-svh shrink-0 flex-col">
      <PageHeader parents={parents} title="Edit post" description={null} />
      <div className="grid w-full flex-1 grid-cols-1 gap-8 px-4 py-6 md:px-6 lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:px-8">
        <div className="min-w-0 space-y-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className={i === 1 ? "h-56 w-full rounded-xl" : "h-20 w-full rounded-xl"} />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-96 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
      <div className="sticky bottom-0 border-t border-border bg-card">
        <div className="flex items-center gap-2 px-4 py-3 md:px-6 lg:px-8">
          <Skeleton className="h-9 w-9 sm:mr-auto sm:w-52" />
          <Skeleton className="h-9 flex-1 sm:w-28 sm:flex-none" />
          <Skeleton className="h-9 flex-1 sm:w-36 sm:flex-none" />
        </div>
      </div>
    </div>
  );
}

function NotEditable({ post }: { post: Post }) {
  const router = useRouter();
  const duplicate = useDuplicatePost();
  const publishing = post.status === "PUBLISHING";

  return (
    <>
      <PageHeader parents={parents} title="Edit post" description={null} />
      <PageBody width="narrow">
        <div className="space-y-4 rounded-xl bg-muted p-6">
          <p className="text-sm text-muted-foreground">
            {publishing
              ? "This post is publishing right now. You can edit it again if any account fails."
              : "Published posts can't be edited. Duplicate it to make a new version."}
          </p>
          <div className="flex flex-wrap gap-2">
            {!publishing ? (
              <Button
                size="sm"
                disabled={duplicate.isPending}
                onClick={() =>
                  duplicate.mutate(post.id, {
                    onSuccess: (copy) => router.push(`/scheduler/posts/${copy.id}/edit`),
                  })
                }
              >
                {duplicate.isPending ? <Spinner /> : <Copy />}
                Duplicate
              </Button>
            ) : null}
            <Link
              href={`/scheduler/posts/${post.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Back to post
            </Link>
          </div>
        </div>
      </PageBody>
    </>
  );
}

export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { data: post, isLoading, error, refetch } = usePost(id);

  // A post opened from a list is already in the cache. If that copy says it
  // can't be edited, say so straight away instead of waiting on the detail
  // request, which the composer only needs for posts it can open.
  const listed = useMemo(() => {
    const lists = queryClient.getQueriesData<{ posts?: Post[] }>({
      queryKey: postQueryKeys.lists(),
    });
    for (const [, data] of lists) {
      const hit = data?.posts?.find((p) => p.id === id);
      if (hit) return hit;
    }
    return undefined;
  }, [id, queryClient]);

  const known = post ?? listed;
  if (known && !canEdit(known.status)) return <NotEditable post={known} />;

  if (isLoading) return <ComposerSkeleton />;

  if (error || !post) {
    return (
      <>
        <PageHeader parents={parents} title="Edit post" description={null} />
        <PageBody width="narrow">
          <ErrorState
            title="Couldn't load this post"
            description={error?.message ?? "It may have been deleted."}
            onRetry={() => void refetch()}
          />
        </PageBody>
      </>
    );
  }

  return <Composer key={post.id} initialFormat={formatForPost(post)} post={post} />;
}
