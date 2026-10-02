"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/shared/states";
import {
  LibraryAudioRow,
  LibraryCard,
  LibrarySkeleton,
  LoadMore,
} from "@/components/files/library-card";
import {
  isLibraryTab,
  LIBRARY_TABS,
  LibrarySourceSelect,
  LibraryTabsList,
  type LibrarySourceFilter,
  type LibraryTab,
} from "@/components/files/library-filters";
import {
  LibraryFolderSelect,
  type FolderFilter,
} from "@/components/files/library-folders";
import { ImportMenu } from "@/components/files/import/import-menu";
import { TransferList } from "@/components/files/import/transfer-list";
import {
  LIBRARY_UPLOAD_ACCEPT,
  useLibrary,
  type LibraryFilterMediaType,
  type LibraryItem,
} from "@/hooks/use-library";
import { useLibraryTransfers } from "@/hooks/use-library-transfers";

export interface LibraryPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Only show this media type. Hides the media tabs. */
  mediaType?: LibraryFilterMediaType;
  /** Allow picking more than one file. Defaults to false. */
  multiple?: boolean;
  /** Most files that can be picked when `multiple` is set. */
  max?: number;
  /** Called with the picked files in the order they were picked. */
  onSelect: (items: LibraryItem[]) => void;
  /** Defaults to a title based on `mediaType`. */
  title?: string;
}

const PICKER_GRID_CLASS = "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4";
const PICKER_ROWS_CLASS = "grid gap-2";

const NOUNS: Record<LibraryTab, { one: string; many: string }> = {
  all: { one: "file", many: "files" },
  video: { one: "video", many: "videos" },
  image: { one: "image", many: "images" },
  audio: { one: "audio file", many: "audio files" },
};

const itemKey = (item: LibraryItem) => `${item.kind}-${item.id}`;

/**
 * Pick completed files from the Library. Used by the Create tools and the
 * post composer. Files can also be uploaded or imported (link, Google Drive,
 * Dropbox, OneDrive) from here, and new files are selected automatically.
 */
export function LibraryPickerDialog(props: LibraryPickerDialogProps) {
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      // Google's picker renders on this page; a click in it must not close us.
      disablePointerDismissal
    >
      <DialogContent className="flex h-[min(85svh,760px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        {/* Mounted only while open, so selection resets each time. */}
        <PickerBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({
  onOpenChange,
  mediaType,
  multiple = false,
  max,
  onSelect,
  title,
}: LibraryPickerDialogProps) {
  const [tab, setTab] = useState<LibraryTab>(mediaType ?? "all");
  const [source, setSource] = useState<LibrarySourceFilter>("all");
  const [folder, setFolder] = useState<FolderFilter>("all");
  const [selected, setSelected] = useState<LibraryItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transfers = useLibraryTransfers({
    folderId: folder !== "all" && folder !== "none" ? folder : null,
  });

  const limit = multiple ? Math.max(1, max ?? Number.POSITIVE_INFINITY) : 1;
  const atLimit = multiple && selected.length >= limit;
  const noun = NOUNS[mediaType ?? "all"];

  const toggle = (item: LibraryItem) => {
    setSelected((prev) => {
      if (prev.some((s) => itemKey(s) === itemKey(item))) {
        return prev.filter((s) => itemKey(s) !== itemKey(item));
      }
      if (!multiple) return [item];
      if (prev.length >= limit) return prev;
      return [...prev, item];
    });
  };

  /** New uploads and imports are selected, up to the limit. */
  const selectNew = (items: LibraryItem[]) => {
    const usable = items.filter(
      (item) => !mediaType || item.mediaType === mediaType,
    );
    if (usable.length === 0) return;
    if (source === "api") setSource("all");
    setSelected((prev) => {
      if (!multiple) return [usable[usable.length - 1]];
      const next = [...prev];
      for (const item of usable) {
        if (next.length >= limit) break;
        if (!next.some((s) => itemKey(s) === itemKey(item))) next.push(item);
      }
      return next;
    });
  };

  const confirm = () => {
    if (selected.length === 0) return;
    onSelect(selected);
    onOpenChange(false);
  };

  const heading =
    title ??
    (mediaType
      ? `Choose ${multiple ? noun.many : `${mediaType === "video" ? "a" : "an"} ${noun.one}`}`
      : "Choose from Library");
  const description = !multiple
    ? `Select one ${noun.one}.`
    : Number.isFinite(limit)
      ? `Select up to ${limit} ${limit === 1 ? noun.one : noun.many}.`
      : `Select one or more ${noun.many}.`;
  const remaining = Number.isFinite(limit) ? Math.max(1, limit - selected.length) : undefined;

  const results = (
    <PickerResults
      tab={tab}
      source={source}
      folder={folder}
      selected={selected}
      atLimit={atLimit}
      onToggle={toggle}
      onUpload={() => fileInputRef.current?.click()}
      noun={NOUNS[tab]}
    />
  );

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (isLibraryTab(value)) setTab(value);
        }}
        className="min-h-0 flex-1 gap-0"
      >
        <div className="space-y-3 border-b p-4">
          <DialogHeader className="pr-8">
            <DialogTitle>{heading}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {mediaType ? <span /> : <LibraryTabsList />}
            <div className="flex flex-wrap items-center gap-2">
              <LibraryFolderSelect value={folder} onChange={setFolder} />
              <LibrarySourceSelect value={source} onValueChange={setSource} />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {mediaType
            ? results
            : LIBRARY_TABS.map((t) => (
                <TabsContent key={t.value} value={t.value}>
                  {t.value === tab ? results : null}
                </TabsContent>
              ))}
        </div>
      </Tabs>

      {transfers.entries.length > 0 ? (
        <div className="border-t px-4 py-3">
          <TransferList
            entries={transfers.entries}
            onDismiss={transfers.dismiss}
            onClearFinished={transfers.clearFinished}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple={multiple}
            accept={
              mediaType
                ? LIBRARY_UPLOAD_ACCEPT[mediaType]
                : "image/*,video/*,audio/*"
            }
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              const files = event.currentTarget.files;
              if (!files?.length) return;
              void transfers
                .upload(Array.from(files))
                .then(selectNew)
                .finally(() => {
                  if (fileInputRef.current) fileInputRef.current.value = "";
                });
            }}
          />
          <ImportMenu
            onUploadClick={() => fileInputRef.current?.click()}
            onImport={(items) => void transfers.importItems(items).then(selectNew)}
            mediaType={mediaType}
            multiple={multiple}
            max={remaining}
          />
          {selected.length > 0 ? (
            <span className="truncate text-sm text-muted-foreground tabular-nums">
              {Number.isFinite(limit) && multiple
                ? `${selected.length} of ${limit} selected`
                : `${selected.length} selected`}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DialogClose render={<Button variant="ghost" size="sm" />}>
            Cancel
          </DialogClose>
          <Button
            size="sm"
            onClick={confirm}
            disabled={selected.length === 0 || transfers.busy}
          >
            {selected.length > 0 ? `Add ${selected.length}` : "Add"}
          </Button>
        </div>
      </div>
    </>
  );
}

function PickerResults({
  tab,
  source,
  folder,
  selected,
  atLimit,
  onToggle,
  onUpload,
  noun,
}: {
  tab: LibraryTab;
  source: LibrarySourceFilter;
  folder: FolderFilter;
  selected: LibraryItem[];
  atLimit: boolean;
  onToggle: (item: LibraryItem) => void;
  onUpload: () => void;
  noun: { one: string; many: string };
}) {
  const library = useLibrary({
    mediaType: tab === "all" ? undefined : tab,
    source: source === "all" ? undefined : source,
    folderId: folder === "all" ? undefined : folder,
  });
  const layout = tab === "audio" ? "rows" : "grid";

  if (library.isPending) {
    return (
      <LibrarySkeleton
        layout={layout}
        count={layout === "rows" ? 6 : 8}
        className={layout === "rows" ? PICKER_ROWS_CLASS : PICKER_GRID_CLASS}
      />
    );
  }

  if (library.items.length === 0) {
    if (library.isError) {
      return (
        <ErrorState
          description={library.error?.message}
          onRetry={() => void library.refetch()}
        />
      );
    }
    return (
      <EmptyState
        variant="inline"
        title={
          folder !== "all"
            ? `No ${noun.many} in this folder`
            : source === "all"
              ? `No ${noun.many} yet`
              : `No ${noun.many} from this source`
        }
        description="Upload or import a file, or make one with a Create tool or your agent."
        action={{ label: "Upload", onClick: onUpload }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label={`Library ${noun.many}`}
        className={layout === "rows" ? PICKER_ROWS_CLASS : PICKER_GRID_CLASS}
      >
        {library.items.map((item) => {
          const isSelected = selected.some((s) => itemKey(s) === itemKey(item));
          const selection = { selected: isSelected, disabled: atLimit };
          return layout === "rows" ? (
            <LibraryAudioRow
              key={`${item.kind}-${item.id}`}
              item={item}
              selection={selection}
              onClick={() => onToggle(item)}
            />
          ) : (
            <LibraryCard
              key={`${item.kind}-${item.id}`}
              item={item}
              selection={selection}
              onClick={() => onToggle(item)}
            />
          );
        })}
      </div>
      <LoadMore
        hasNextPage={library.hasNextPage}
        isFetchingNextPage={library.isFetchingNextPage}
        isError={library.isFetchNextPageError}
        onLoadMore={() => void library.fetchNextPage()}
      />
    </div>
  );
}
