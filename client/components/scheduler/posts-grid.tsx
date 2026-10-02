"use client";

import { useState, useCallback } from "react";
import { PostCard } from "@/components/scheduler/post-card";
import type { Post } from "@/hooks/use-posts";
import { useBulkDeletePosts } from "@/hooks/use-posts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash as Trash2, X, Warning as AlertTriangle } from "@phosphor-icons/react";
import { Spinner } from "@/components/ui/spinner";

interface PostsGridProps {
  posts: Post[];
}

export function PostsGrid({ posts }: PostsGridProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const bulkDeleteMutation = useBulkDeletePosts();

  const selectionMode = selectedIds.size > 0;

  const toggleSelect = useCallback((postId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(posts.map((p) => p.id)));
  }, [posts]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    bulkDeleteMutation.mutate(ids, {
      onSuccess: () => {
        clearSelection();
        setShowDeleteDialog(false);
      },
      onError: () => {
        setShowDeleteDialog(false);
      },
    });
  }, [selectedIds, bulkDeleteMutation, clearSelection]);

  const allSelected = posts.length > 0 && selectedIds.size === posts.length;

  return (
    <>
      {/* Bulk action bar */}
      {selectionMode && (
        <div className="sticky top-0 z-20 flex items-center justify-between gap-4 rounded-lg border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => {
                if (checked) selectAll();
                else clearSelection();
              }}
            />
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={bulkDeleteMutation.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Posts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            selectionMode={selectionMode}
            isSelected={selectedIds.has(post.id)}
            onSelect={toggleSelect}
          />
        ))}
      </div>

      {/* Bulk delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete {selectedIds.size} Post{selectedIds.size !== 1 ? "s" : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              {selectedIds.size === 1
                ? "this post"
                : `these ${selectedIds.size} posts`}
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              variant="destructive"
            >
              {bulkDeleteMutation.isPending ? (
                <>
                  <Spinner className="mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
