"use client";

import { Suspense, useState } from "react";
import { toast } from "sonner";
import { FilmSlate } from "@phosphor-icons/react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { DeleteDialog } from "@/components/subtitle-editor/delete-dialog";
import {
  EXPORT_GRID_CLASS,
  ExportCard,
  ExportCardSkeleton,
} from "@/components/subtitle-editor/export-card";
import { failureMessage } from "@/components/subtitle-editor/format";
import {
  ListPagination,
  usePageParam,
} from "@/components/subtitle-editor/list-pagination";
import type { ExportListItem } from "@/hooks/subtitle/use-subtitle-api";
import {
  SUBTITLE_PAGE_SIZE,
  useDeleteSubtitleExport,
  useSubtitleExports,
} from "@/hooks/subtitle/use-subtitle-queries";

const PARENTS = [{ label: "Subtitles", href: "/subtitle-editor" }];

function ExportsGridSkeleton() {
  return (
    <div className={EXPORT_GRID_CLASS} aria-busy>
      {Array.from({ length: SUBTITLE_PAGE_SIZE }, (_, i) => (
        <ExportCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default function SubtitleExportsPage() {
  return (
    <>
      <PageHeader
        parents={PARENTS}
        title="Exports"
        description="Videos rendered from your subtitle projects"
      />
      <PageBody>
        <Suspense fallback={<ExportsGridSkeleton />}>
          <ExportsList />
        </Suspense>
      </PageBody>
    </>
  );
}

function ExportsList() {
  const page = usePageParam();
  const { data, isPending, isError, error, refetch, isPlaceholderData } =
    useSubtitleExports(page);
  const deleteExport = useDeleteSubtitleExport();
  const [pendingDelete, setPendingDelete] = useState<ExportListItem | null>(
    null,
  );

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteExport.mutate(pendingDelete.id, {
      onSuccess: () => {
        setPendingDelete(null);
        toast.success("Export deleted");
      },
      onError: (err) => toast.error(failureMessage("delete the export", err)),
    });
  };

  if (isPending) return <ExportsGridSkeleton />;

  if (isError && !data) {
    return (
      <ErrorState
        title="Couldn't load your exports"
        description={error.message}
        onRetry={() => void refetch()}
      />
    );
  }

  const items = data?.items ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;

  if (items.length === 0) {
    return page > 1 ? (
      <EmptyState
        icon={FilmSlate}
        title="Nothing on this page"
        description="This page is past the end of your exports."
        action={{ label: "Go to first page", href: "/subtitle-editor/exports" }}
      />
    ) : (
      <EmptyState
        icon={FilmSlate}
        title="No exports yet"
        description="Export a subtitle project and the video shows up here."
        action={{ label: "Open projects", href: "/subtitle-editor" }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div
        aria-busy={isPlaceholderData}
        className={isPlaceholderData ? "opacity-70 transition-opacity" : undefined}
      >
        <div className={EXPORT_GRID_CLASS}>
          {items.map((item) => (
            <ExportCard
              key={item.id}
              item={item}
              onDelete={setPendingDelete}
              showProjectLink
            />
          ))}
        </div>
      </div>
      <ListPagination page={page} totalPages={totalPages} />
      <DeleteDialog
        open={pendingDelete !== null}
        title="Delete this export?"
        description="The exported video is deleted for good. Its project stays."
        isDeleting={deleteExport.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
