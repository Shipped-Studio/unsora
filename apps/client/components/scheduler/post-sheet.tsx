"use client";

import Link from "next/link";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/states";
import { PostDetails } from "@/components/scheduler/post-details";
import { usePost } from "@/hooks/use-posts";

/** Quick look at a post without leaving the calendar or queue. */
export function PostSheet({
  postId,
  onOpenChange,
}: {
  postId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: post, isLoading, error, refetch } = usePost(postId ?? undefined);

  return (
    <Sheet open={postId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>Post</SheetTitle>
          <SheetDescription className="sr-only">Details and actions for this post</SheetDescription>
          {postId ? (
            <Link
              href={`/scheduler/posts/${postId}`}
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "absolute top-3 right-12",
              })}
            >
              Open page
              <ArrowSquareOut />
            </Link>
          ) : null}
        </SheetHeader>
        <div className="p-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : error || !post ? (
            <ErrorState
              title="Couldn't load this post"
              description={error?.message}
              onRetry={() => void refetch()}
            />
          ) : (
            <PostDetails post={post} onDeleted={() => onOpenChange(false)} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
