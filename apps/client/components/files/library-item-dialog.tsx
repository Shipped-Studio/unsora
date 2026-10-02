"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import {
  CalendarPlus,
  DownloadSimple,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/api-keys/copy-button";
import {
  LibraryItemIcon,
  libraryRelativeDate,
} from "@/components/files/library-card";
import { LibraryFolderSelect } from "@/components/files/library-folders";
import {
  formatLibraryDuration,
  isLibraryItemReady,
  LIBRARY_SOURCE_LABELS,
  libraryDeletePath,
  libraryDownloadHref,
  libraryDownloadName,
  libraryItemTitle,
  libraryKindLabel,
  libraryLabelName,
  useDeleteLibraryItem,
  useMoveLibraryItems,
  useRenameLibraryItem,
  type LibraryItem,
} from "@/hooks/use-library";
import { scheduleHref } from "@/lib/scheduler/formats";

const cdnLoader = ({ src }: { src: string }) => src;

function Preview({ item }: { item: LibraryItem }) {
  const title = libraryItemTitle(item);

  if (item.url && item.mediaType === "video") {
    return (
      <video
        key={item.id}
        src={item.url}
        poster={item.thumbnailUrl ?? undefined}
        controls
        playsInline
        preload="metadata"
        className="max-h-[65svh] w-full rounded-md object-contain"
      />
    );
  }

  if (item.url && item.mediaType === "image") {
    return (
      <Image
        loader={cdnLoader}
        src={item.url}
        alt={title}
        width={item.width ?? 1200}
        height={item.height ?? 1200}
        sizes="(min-width: 768px) 560px, 100vw"
        className="h-auto max-h-[65svh] w-auto max-w-full rounded-md object-contain"
      />
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-4 py-6">
      <span className="flex size-14 items-center justify-center rounded-lg bg-background text-muted-foreground">
        <LibraryItemIcon item={item} className="size-7" />
      </span>
      {item.url && item.mediaType === "audio" ? (
        <audio key={item.id} src={item.url} controls className="w-full max-w-md" />
      ) : (
        <p className="text-sm text-muted-foreground">No preview for this file.</p>
      )}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 wrap-break-word text-foreground">{children}</dd>
    </>
  );
}

/** The upload's file name, editable in place. */
function FileName({ item }: { item: LibraryItem }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.label ?? "");
  const rename = useRenameLibraryItem();

  if (!editing) {
    return (
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm wrap-break-word">{item.label}</p>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Rename"
          onClick={() => {
            setName(item.label ?? "");
            setEditing(true);
          }}
        >
          <PencilSimple />
        </Button>
      </div>
    );
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === item.label) {
      setEditing(false);
      return;
    }
    rename.mutate(
      { item, name: trimmed },
      {
        onSuccess: () => {
          toast.success("File renamed");
          setEditing(false);
        },
        onError: (error) => toast.error(`Couldn't rename the file. ${error.message}`),
      },
    );
  };

  return (
    <form onSubmit={save} className="flex items-center gap-2">
      <Input
        value={name}
        maxLength={200}
        aria-label="File name"
        className="h-8"
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            setEditing(false);
          }
        }}
      />
      <Button type="submit" size="sm" disabled={rename.isPending}>
        {rename.isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

function FolderPicker({ item }: { item: LibraryItem }) {
  const move = useMoveLibraryItems();
  return (
    <LibraryFolderSelect
      value={item.folderId ?? "none"}
      className="h-8 w-full"
      onChange={(value) => {
        if (value === "all") return;
        const folderId = value === "none" ? null : value;
        if (folderId === item.folderId) return;
        move.mutate(
          { items: [item], folderId },
          {
            onSuccess: () =>
              toast.success(folderId ? "Moved to folder" : "Removed from folder"),
            onError: (error) => toast.error(`Couldn't move the file. ${error.message}`),
          },
        );
      }}
    />
  );
}

interface LibraryItemDialogProps {
  item: LibraryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Preview, details and actions for one Library file. */
export function LibraryItemDialog({
  item,
  open,
  onOpenChange,
}: LibraryItemDialogProps) {
  // Keep showing the last item while the dialog animates out.
  const [lastItem, setLastItem] = useState(item);
  if (item && item !== lastItem) setLastItem(item);
  const current = item ?? lastItem;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteItem = useDeleteLibraryItem();

  if (!current) return null;

  const ready = isLibraryItemReady(current);
  const canSchedule =
    ready && (current.mediaType === "video" || current.mediaType === "image");
  const canDelete = libraryDeletePath(current) !== null;
  const duration = formatLibraryDuration(current.duration);
  const created = new Date(current.createdAt);
  const downloadHref = libraryDownloadHref(current);

  const handleDelete = () => {
    deleteItem.mutate(current, {
      onSuccess: () => {
        toast.success("File deleted");
        setConfirmOpen(false);
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(`Couldn't delete this file. ${error.message}`);
      },
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[calc(100svh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-4xl">
          <div className="grid md:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="flex min-h-56 items-center justify-center bg-muted p-4 max-md:rounded-t-xl md:rounded-l-xl">
              <Preview item={current} />
            </div>

            <div className="flex min-w-0 flex-col gap-5 p-5">
              <DialogHeader className="pr-8">
                <DialogTitle>{libraryKindLabel(current.kind)}</DialogTitle>
                <DialogDescription>
                  Created {libraryRelativeDate(current.createdAt)}
                </DialogDescription>
              </DialogHeader>

              {current.kind === "upload" && current.assetId ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">File name</p>
                  <FileName key={current.id} item={current} />
                </div>
              ) : current.label ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {libraryLabelName(current.kind)}
                  </p>
                  <p className="max-h-40 overflow-y-auto text-sm wrap-break-word whitespace-pre-wrap">
                    {current.label}
                  </p>
                </div>
              ) : null}

              <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-sm">
                <DetailRow label="Type">{libraryKindLabel(current.kind)}</DetailRow>
                {current.model ? (
                  <DetailRow label="Model">{current.model}</DetailRow>
                ) : null}
                <DetailRow label="Source">
                  {LIBRARY_SOURCE_LABELS[current.source] ?? current.source}
                </DetailRow>
                {current.credits > 0 ? (
                  <DetailRow label="Credits">
                    <span className="tabular-nums">
                      {current.credits} {current.credits === 1 ? "credit" : "credits"}
                    </span>
                  </DetailRow>
                ) : null}
                {current.width && current.height ? (
                  <DetailRow label="Size">
                    <span className="tabular-nums">
                      {current.width} × {current.height}
                    </span>
                  </DetailRow>
                ) : null}
                {duration ? (
                  <DetailRow label="Duration">
                    <span className="tabular-nums">{duration}</span>
                  </DetailRow>
                ) : null}
                <DetailRow label="Created">
                  {Number.isNaN(created.getTime())
                    ? current.createdAt
                    : format(created, "MMM d, yyyy, h:mm a")}
                </DetailRow>
                {current.assetId && ready ? (
                  <DetailRow label="Folder">
                    <FolderPicker item={current} />
                  </DetailRow>
                ) : null}
              </dl>

              <div className="mt-auto flex flex-col gap-2">
                {canSchedule && current.url ? (
                  <Link
                    href={scheduleHref({
                      url: current.url,
                      mediaType: current.mediaType,
                    })}
                    className={buttonVariants({ size: "sm", className: "w-full" })}
                  >
                    <CalendarPlus />
                    Create post
                  </Link>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {current.url && downloadHref ? (
                    <>
                      <a
                        href={downloadHref}
                        download={libraryDownloadName(current)}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <DownloadSimple />
                        Download
                      </a>
                      <CopyButton
                        value={current.url}
                        label="Copy link"
                        showLabel
                        message="Link copied"
                        variant="outline"
                      />
                    </>
                  ) : null}
                  {canDelete ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmOpen(true)}
                    >
                      <Trash />
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (!deleteItem.isPending) setConfirmOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed from your Library. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteItem.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteItem.isPending}
            >
              {deleteItem.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
