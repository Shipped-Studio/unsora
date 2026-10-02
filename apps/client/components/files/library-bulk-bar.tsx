"use client";

import { useState } from "react";
import { DownloadSimple, Trash, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { MoveToFolderMenu } from "@/components/files/library-folders";
import {
  libraryDeletePath,
  libraryDownloadHref,
  libraryDownloadName,
  useDeleteLibraryItems,
  useMoveLibraryItems,
  type LibraryItem,
} from "@/hooks/use-library";

function files(n: number) {
  return `${n} ${n === 1 ? "file" : "files"}`;
}

/** Starts one download per item, spaced out so browsers don't drop them. */
function downloadAll(items: LibraryItem[]) {
  const downloadable = items.filter((item) => libraryDownloadHref(item));
  downloadable.forEach((item, index) => {
    window.setTimeout(() => {
      const link = document.createElement("a");
      link.href = libraryDownloadHref(item) as string;
      link.download = libraryDownloadName(item);
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }, index * 400);
  });
  return downloadable.length;
}

/** Actions for the selected files on the Library page. */
export function LibraryBulkBar({
  selected,
  loadedCount,
  onSelectAll,
  onClear,
  onRemoved,
  currentFolderId,
}: {
  selected: LibraryItem[];
  loadedCount: number;
  onSelectAll: () => void;
  onClear: () => void;
  /** Items that left the current view (deleted or moved away). */
  onRemoved: (items: LibraryItem[]) => void;
  /** The folder being viewed, when a single folder is open. */
  currentFolderId?: string | null;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const move = useMoveLibraryItems();
  const remove = useDeleteLibraryItems();

  const count = selected.length;
  const deletable = selected.filter((item) => libraryDeletePath(item)).length;
  const skipped = count - deletable;
  const busy = move.isPending || remove.isPending;

  const handleMove = (folderId: string | null, folderName: string) => {
    move.mutate(
      { items: selected, folderId },
      {
        onSuccess: ({ moved, skipped: notMoved }) => {
          const where = folderId ? `to ${folderName}` : "to Unfiled";
          toast.success(
            notMoved > 0
              ? `Moved ${files(moved)} ${where}. ${files(notMoved)} couldn't be moved.`
              : `Moved ${files(moved)} ${where}`,
          );
          onRemoved(selected.filter((item) => item.assetId));
        },
        onError: (error) =>
          toast.error(`Couldn't move the files. ${error.message}`),
      },
    );
  };

  const handleDelete = () => {
    remove.mutate(selected, {
      onSuccess: ({ deleted, failed }) => {
        setConfirmOpen(false);
        onRemoved(deleted);
        if (failed.length === 0) {
          toast.success(`Deleted ${files(deleted.length)}`);
        } else {
          toast.error(
            `Deleted ${files(deleted.length)}. Couldn't delete ${files(failed.length)}. Try again.`,
          );
        }
      },
    });
  };

  if (count === 0) return null;

  return (
    <>
      <div
        role="toolbar"
        aria-label="Selected files"
        className="sticky bottom-4 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-xl border bg-popover p-2 pl-3 text-popover-foreground shadow-md"
      >
        <span className="text-sm font-medium tabular-nums">
          {count} selected
        </span>
        {count < loadedCount ? (
          <Button variant="ghost" size="sm" onClick={onSelectAll}>
            Select all {loadedCount}
          </Button>
        ) : null}
        <MoveToFolderMenu
          onMove={handleMove}
          disabled={busy}
          currentFolderId={currentFolderId}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => {
            const started = downloadAll(selected);
            if (started > 1) toast.success(`Started ${started} downloads`);
          }}
        >
          <DownloadSimple />
          Download
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={busy || deletable === 0}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash />
          Delete
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Clear selection"
          onClick={onClear}
        >
          <X />
        </Button>
      </div>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!remove.isPending) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {files(deletable)}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletable === 1 ? "It" : "They"} will be removed from your
              Library. This can&apos;t be undone.
              {skipped > 0
                ? ` ${files(skipped)} can't be deleted here and will be skipped.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={handleDelete}
            >
              {remove.isPending ? "Deleting…" : `Delete ${files(deletable)}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
