"use client";

import {
  PostCardSkeletonGrid,
  PostsListPageSkeleton,
} from "@/components/scheduler/post-card-skeleton";
import { PostsGrid } from "@/components/scheduler/posts-grid";
import { EmptyState } from "@/components/scheduler/empty-state";
import { PostsPagination } from "@/components/scheduler/posts-pagination";
import { usePosts } from "@/hooks/use-posts";
import { Plus, CheckCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";

export default function PostedPostsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = usePosts({
    status: "PUBLISHED",
    page,
    limit: 12,
  });

  if (isLoading && !data) {
    return <PostsListPageSkeleton count={12} />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Posted
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Posts that have been successfully published to your social media
            accounts
          </p>
        </div>
        <Button
          render={<Link href="/scheduler/posts/create" />}
          className="w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Create Post
        </Button>
      </div>

      {/* Stats */}
      {data && data.posts.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle className="h-4 w-4" />
          <span>{data.pagination.total} posted</span>
        </div>
      )}

      {/* Posts Grid */}
      {isLoading ? (
        <PostCardSkeletonGrid count={12} />
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Failed to load posts</p>
        </div>
      ) : !data || data.posts.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="No posted yet"
          description="Your posted posts will appear here"
          actionLabel="Create and publish your first post"
          actionHref="/scheduler/posts/create"
        />
      ) : (
        <>
          <PostsGrid posts={data.posts} />
          <PostsPagination
            page={page}
            totalPages={data.pagination.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
