"use client";

import {
  PostCardSkeletonGrid,
  PostsListPageSkeleton,
} from "@/components/scheduler/post-card-skeleton";
import { PostsGrid } from "@/components/scheduler/posts-grid";
import { EmptyState } from "@/components/scheduler/empty-state";
import { PostsPagination } from "@/components/scheduler/posts-pagination";
import { usePosts } from "@/hooks/use-posts";
import { getStatusText, type PostStatus } from "@/lib/post-utils";
import { Plus, FileX } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

export default function PostsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = usePosts({
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    limit: 12,
  });

  // First load (no cached data) — render full-page skeleton.
  if (isLoading && !data) {
    return <PostsListPageSkeleton count={12} showFilter />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            All Posts
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Manage your scheduled and published posts
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

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            if (v) setStatusFilter(v);
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Posts</SelectItem>
            <SelectItem value="DRAFT">Drafts</SelectItem>
            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="PUBLISHING">Publishing</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
            <SelectItem value="PARTIALLY_PUBLISHED">
              Partially published
            </SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>

        {data && (
          <p className="text-sm text-muted-foreground">
            {data.pagination.total} total post
            {data.pagination.total !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Posts Grid */}
      {isLoading ? (
        <PostCardSkeletonGrid count={12} />
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Failed to load posts</p>
        </div>
      ) : !data || data.posts.length === 0 ? (
        <EmptyState
          icon={FileX}
          title={`No posts found${
            statusFilter !== "all"
              ? ` with status "${getStatusText(statusFilter as PostStatus)}"`
              : ""
          }`}
          description={
            statusFilter !== "all"
              ? "Try adjusting your filters or create a new post"
              : "Start creating posts to see them here"
          }
          actionLabel="Create your first post"
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
