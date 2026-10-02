"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FolderOpen, UploadSimple } from "@phosphor-icons/react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/shared/states";
import {
  LIBRARY_GRID_CLASS,
  LIBRARY_ROWS_CLASS,
  LibraryAudioRow,
  LibraryCard,
  LibrarySkeleton,
  LoadMore,
} from "@/components/files/library-card";
import {
  isLibrarySourceFilter,
  isLibraryTab,
  kindsForTab,
  LIBRARY_TABS,
  LibraryKindSelect,
  LibrarySourceSelect,
  LibraryTabsList,
  type LibrarySourceFilter,
  type LibraryTab,
} from "@/components/files/library-filters";
import {
  folderFilterLabel,
  LibraryFolderBar,
  LibraryFolderRail,
  type FolderFilter,
} from "@/components/files/library-folders";
import { LibraryItemDialog } from "@/components/files/library-item-dialog";
import { LibraryBulkBar } from "@/components/files/library-bulk-bar";
import { ImportMenu } from "@/components/files/import/import-menu";
import { TransferList } from "@/components/files/import/transfer-list";
import {
  isLibraryKind,
  LIBRARY_TOOL_HREF,
  useLibrary,
  useLibraryFolders,
  type LibraryItem,
  type LibraryKind,
} from "@/hooks/use-library";
import { useLibraryTransfers } from "@/hooks/use-library-transfers";
import { cn } from "@/lib/utils";

export default function LibraryPage() {
  return (
    <Suspense fallback={<LibraryFallback />}>
      <LibraryView />
    </Suspense>
  );
}

function LibraryFallback() {
  return (
    <>
      <PageHeader />
      <PageBody>
        <LibrarySkeleton />
      </PageBody>
    </>
  );
}

/**
 * Filters live in the URL:
 * ?tab=video&kind=clip&source=api&folder=<id>|none&item=<id>
 */
function useLibraryParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get("tab");
  const tab: LibraryTab = isLibraryTab(rawTab) ? rawTab : "all";
  const rawKind = searchParams.get("kind");
  const kind: LibraryKind | "all" =
    isLibraryKind(rawKind) && kindsForTab(tab).includes(rawKind)
      ? rawKind
      : "all";
  const rawSource = searchParams.get("source");
  const source: LibrarySourceFilter = isLibrarySourceFilter(rawSource)
    ? rawSource
    : "all";
  const rawFolder = searchParams.get("folder");
  const folder: FolderFilter =
    rawFolder && rawFolder.length <= 64 ? rawFolder : "all";
  const itemId = searchParams.get("item");

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "all") params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return { tab, kind, source, folder, itemId, setParams };
}

const EMPTY_COPY: Record<
  LibraryTab,
  { title: string; description: string; tool?: string }
> = {
  all: {
    title: "Your Library is empty",
    description:
      "Uploads, imports, files you create here, and files your agents make over MCP or the API all show up here.",
  },
  video: {
    title: "No videos yet",
    description:
      "Videos you generate, clip, upload or import show up here. Your agent can also make them over MCP or the API.",
    tool: "Open video tool",
  },
  image: {
    title: "No images yet",
    description:
      "Images and thumbnails you generate, upload or import show up here. Your agent can also make them over MCP or the API.",
    tool: "Open image tool",
  },
  audio: {
    title: "No audio yet",
    description:
      "Music, voiceovers and audio you upload or import show up here. Your agent can also make them over MCP or the API.",
    tool: "Open music tool",
  },
};

const itemKey = (item: LibraryItem) => `${item.kind}-${item.id}`;

function LibraryView() {
  const { tab, kind, source, folder, itemId, setParams } = useLibraryParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folders = useLibraryFolders();

  // Uploads and imports go into the open folder.
  const targetFolderId = folder !== "all" && folder !== "none" ? folder : null;
  const transfers = useLibraryTransfers({ folderId: targetFolderId });

  // A deep link (?item=) opens that file once it's in the loaded list.
  const [openId, setOpenId] = useState<string | null>(itemId);

  const library = useLibrary({
    mediaType: tab === "all" ? undefined : tab,
    kind: kind === "all" ? undefined : kind,
    source: source === "all" ? undefined : source,
    folderId: folder === "all" ? undefined : folder,
  });

  // Multi-select. Cleared whenever the filters change.
  const filterKey = `${tab}|${kind}|${source}|${folder}`;
  const [selection, setSelection] = useState<{
    filterKey: string;
    keys: Set<string>;
    anchor: string | null;
  }>({ filterKey, keys: new Set(), anchor: null });
  if (selection.filterKey !== filterKey) {
    setSelection({ filterKey, keys: new Set(), anchor: null });
  }
  const selectedItems = library.items.filter((item) =>
    selection.keys.has(itemKey(item)),
  );
  const selecting = selectedItems.length > 0;

  const toggleItem = (item: LibraryItem, range: boolean) => {
    const key = itemKey(item);
    setSelection((prev) => {
      const keys = new Set(prev.keys);
      if (range && prev.anchor) {
        const order = library.items.map(itemKey);
        const from = order.indexOf(prev.anchor);
        const to = order.indexOf(key);
        if (from !== -1 && to !== -1) {
          const [start, end] = from < to ? [from, to] : [to, from];
          order.slice(start, end + 1).forEach((k) => keys.add(k));
          return { ...prev, keys, anchor: key };
        }
      }
      if (keys.has(key)) keys.delete(key);
      else keys.add(key);
      return { ...prev, keys, anchor: key };
    });
  };

  const clearSelection = useCallback(() => {
    setSelection((prev) => ({ ...prev, keys: new Set(), anchor: null }));
  }, []);

  useEffect(() => {
    if (!selecting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting, clearSelection]);

  // Drag files anywhere on the page to upload them.
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const hasFiles = (event: React.DragEvent) =>
    Array.from(event.dataTransfer.types).includes("Files");

  const openItem: LibraryItem | null = openId
    ? (library.items.find((item) => item.id === openId) ?? null)
    : null;

  const closeItem = () => {
    setOpenId(null);
    if (itemId) setParams({ item: null });
  };

  const openFilePicker = () => fileInputRef.current?.click();
  const filtered = kind !== "all" || source !== "all";
  const layout = tab === "audio" ? "rows" : "grid";
  const folderName = folderFilterLabel(folder, folders.data);

  let content: React.ReactNode;
  if (library.isPending) {
    content = <LibrarySkeleton layout={layout} count={layout === "rows" ? 8 : 12} />;
  } else if (library.items.length === 0 && library.isError) {
    content = (
      <ErrorState
        title="Couldn't load your Library"
        description={library.error?.message}
        onRetry={() => void library.refetch()}
      />
    );
  } else if (library.items.length === 0) {
    const copy = EMPTY_COPY[tab];
    if (filtered) {
      content = (
        <EmptyState
          icon={FolderOpen}
          title="Nothing matches these filters"
          description="Try another type or source."
          action={{
            label: "Clear filters",
            onClick: () => setParams({ kind: null, source: null }),
          }}
        />
      );
    } else if (folder !== "all") {
      content = (
        <EmptyState
          icon={FolderOpen}
          title={folder === "none" ? "No unfiled files" : "This folder is empty"}
          description={
            folder === "none"
              ? "Every file here is in a folder."
              : "Upload or import straight into this folder, or select files in All files and move them here."
          }
          action={
            folder === "none"
              ? undefined
              : { label: "Upload", onClick: openFilePicker }
          }
          secondaryAction={{
            label: "View all files",
            onClick: () => setParams({ folder: null }),
          }}
        />
      );
    } else {
      content = (
        <EmptyState
          icon={FolderOpen}
          title={copy.title}
          description={copy.description}
          action={{ label: "Connect an agent", href: "/connect-agent" }}
          secondaryAction={
            tab === "all"
              ? { label: "Upload a file", onClick: openFilePicker }
              : { label: copy.tool ?? "Open a tool", href: LIBRARY_TOOL_HREF[tab] }
          }
        />
      );
    }
  } else {
    content = (
      <div className="space-y-6">
        <div className={layout === "rows" ? LIBRARY_ROWS_CLASS : LIBRARY_GRID_CLASS}>
          {library.items.map((item) => {
            const bulk = {
              selected: selection.keys.has(itemKey(item)),
              active: selecting,
              onToggle: (range: boolean) => toggleItem(item, range),
            };
            return layout === "rows" ? (
              <LibraryAudioRow
                key={itemKey(item)}
                item={item}
                bulk={bulk}
                onClick={() => setOpenId(item.id)}
              />
            ) : (
              <LibraryCard
                key={itemKey(item)}
                item={item}
                bulk={bulk}
                onClick={() => setOpenId(item.id)}
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

  return (
    <>
      <PageHeader
        parents={folder !== "all" ? [{ label: "Library", href: "/files" }] : undefined}
        title={folder !== "all" ? folderName : undefined}
        description={folder !== "all" ? null : undefined}
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                const files = event.currentTarget.files;
                if (!files?.length) return;
                void transfers.upload(Array.from(files)).finally(() => {
                  if (fileInputRef.current) fileInputRef.current.value = "";
                });
              }}
            />
            <ImportMenu
              variant="default"
              onUploadClick={openFilePicker}
              onImport={(items) => void transfers.importItems(items)}
            />
          </>
        }
      />
      <PageBody
        className="relative"
        onDragEnter={(event) => {
          if (!hasFiles(event)) return;
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => {
          if (hasFiles(event)) event.preventDefault();
        }}
        onDragLeave={(event) => {
          if (!hasFiles(event)) return;
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={(event) => {
          if (!hasFiles(event)) return;
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          void transfers.upload(Array.from(event.dataTransfer.files));
        }}
      >
        <div className="flex gap-8">
          <aside className="hidden w-52 shrink-0 md:block">
            <div className="sticky top-20">
              <LibraryFolderRail
                value={folder}
                onChange={(value) => setParams({ folder: value })}
              />
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-4">
            <Tabs
              value={tab}
              onValueChange={(value) => {
                if (!isLibraryTab(value)) return;
                const keepKind =
                  kind !== "all" && kindsForTab(value).includes(kind);
                setParams({ tab: value, kind: keepKind ? kind : null });
              }}
              className="gap-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <LibraryTabsList />
                <div className="flex flex-wrap items-center gap-2">
                  {!library.isPending && library.total > 0 ? (
                    <span className="mr-1 text-sm text-muted-foreground tabular-nums">
                      {library.total.toLocaleString()}{" "}
                      {library.total === 1 ? "file" : "files"}
                    </span>
                  ) : null}
                  <div className="md:hidden">
                    <LibraryFolderBar
                      value={folder}
                      onChange={(value) => setParams({ folder: value })}
                    />
                  </div>
                  <LibraryKindSelect
                    tab={tab}
                    value={kind}
                    onValueChange={(value) => setParams({ kind: value })}
                  />
                  <LibrarySourceSelect
                    value={source}
                    onValueChange={(value) => setParams({ source: value })}
                  />
                </div>
              </div>

              <TransferList
                entries={transfers.entries}
                onDismiss={transfers.dismiss}
                onClearFinished={transfers.clearFinished}
              />

              {LIBRARY_TABS.map((t) => (
                <TabsContent key={t.value} value={t.value}>
                  {t.value === tab ? content : null}
                </TabsContent>
              ))}
            </Tabs>

            <LibraryBulkBar
              selected={selectedItems}
              loadedCount={library.items.length}
              currentFolderId={folder === "all" ? undefined : folder === "none" ? null : folder}
              onSelectAll={() =>
                setSelection((prev) => ({
                  ...prev,
                  keys: new Set(library.items.map(itemKey)),
                }))
              }
              onClear={clearSelection}
              onRemoved={(items) =>
                setSelection((prev) => {
                  const keys = new Set(prev.keys);
                  items.forEach((item) => keys.delete(itemKey(item)));
                  return { ...prev, keys };
                })
              }
            />
          </div>
        </div>

        <div
          aria-hidden
          className={cn(
            "pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-background/80 transition-opacity",
            dragging ? "opacity-100" : "opacity-0",
          )}
        >
          <div className="flex flex-col items-center gap-2 rounded-xl bg-muted px-10 py-8 text-center">
            <UploadSimple className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">Drop to upload</p>
            <p className="text-xs text-muted-foreground">
              {targetFolderId ? `Files go into ${folderName}.` : "Images, videos and audio."}
            </p>
          </div>
        </div>
      </PageBody>

      <LibraryItemDialog
        item={openItem}
        open={openItem !== null}
        onOpenChange={(open) => {
          if (!open) closeItem();
        }}
      />
    </>
  );
}
