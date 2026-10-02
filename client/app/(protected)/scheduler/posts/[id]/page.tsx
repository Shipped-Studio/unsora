"use client";

import { useRouter } from "next/navigation";
import { use, useMemo } from "react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { PostDetails } from "@/components/scheduler/post-details";
import { useAnalyticsSummary, type Metrics } from "@/hooks/use-analytics";
import { usePost } from "@/hooks/use-posts";

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: post, isLoading, error, refetch } = usePost(id);
  const hasPublished = post?.postAccounts.some((leg) => leg.published) ?? false;
  const analytics = useAnalyticsSummary(90, { enabled: hasPublished });

  const metrics = useMemo(() => {
    const byLeg: Record<string, Metrics> = {};
    for (const item of analytics.data?.posts ?? []) byLeg[item.postAccountId] = item.metrics;
    return byLeg;
  }, [analytics.data]);

  const title = post
    ? post.mainCaption.trim().split("\n")[0].slice(0, 60) || "Untitled post"
    : "Post";

  return (
    <>
      <PageHeader
        parents={[{ label: "Posts", href: "/scheduler/posts" }]}
        title={title}
        description={null}
      />
      <PageBody width="narrow">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : error || !post ? (
          <ErrorState
            title="Couldn't load this post"
            description={error?.message ?? "It may have been deleted."}
            onRetry={() => void refetch()}
          />
        ) : (
          <PostDetails
            post={post}
            metrics={metrics}
            onDeleted={() => router.push("/scheduler/posts")}
          />
        )}
      </PageBody>
    </>
  );
}
