"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSubtitleApi } from "@/hooks/subtitle/use-subtitle-api";
import {
  ExportCard,
  ExportCardSkeleton,
  ExportsEmptyState,
} from "@/components/subtitle-editor/export-card";
import { DeleteExportDialog } from "@/components/subtitle-editor/delete-export-dialog";
import {
  ProjectsPagination,
  type PaginationMeta,
} from "@/components/subtitle-editor/projects-pagination";
import type { ExportListItem } from "@/components/subtitle-editor/exports-list";

const PAGE_SIZE = 12;

function ExportsGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ExportCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default function ExportsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 p-4 sm:p-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Exported Videos
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Every video you exported from the subtitle editor.
            </p>
          </div>
          <ExportsGridSkeleton count={PAGE_SIZE} />
        </div>
      }
    >
      <ExportsIndex />
    </Suspense>
  );
}

function ExportsIndex() {
  const { getUserExports, deleteExport } = useSubtitleApi();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = useMemo(() => {
    const raw = parseInt(searchParams.get("page") ?? "1", 10);
    return Number.isFinite(raw) && raw >= 1 ? raw : 1;
  }, [searchParams]);

  const [items, setItems] = useState<ExportListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const goToPage = useCallback(
    (target: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (target <= 1) {
        params.delete("page");
      } else {
        params.set("page", String(target));
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const result = await getUserExports(page, PAGE_SIZE);
        if (cancelled) return;
        if (result.success && Array.isArray(result.data)) {
          setItems(result.data as ExportListItem[]);
          if (result.pagination) {
            setPagination(result.pagination as PaginationMeta);
          }
        } else if (!result.success) {
          toast.error(result.error || "Failed to load exports");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // useSubtitleApi returns new function references on every render, so we
    // intentionally only depend on `page` here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return;
    setIsDeleting(true);
    try {
      const result = await deleteExport(pendingDeleteId);
      if (result.success) {
        setItems((prev) => prev.filter((e) => e.id !== pendingDeleteId));
        setPagination((prev) =>
          prev
            ? { ...prev, totalCount: Math.max(0, prev.totalCount - 1) }
            : prev,
        );
        toast.success("Export deleted");
        setPendingDeleteId(null);
      } else {
        toast.error(result.error || "Failed to delete export");
      }
    } finally {
      setIsDeleting(false);
    }
    // deleteExport identity changes every render; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDeleteId]);

  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push("/subtitle-editor")}
        >
          <CaretLeft />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Exported Videos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Every video you exported from the subtitle editor, ready to watch
            and download.
          </p>
        </div>
      </div>

      {isLoading ? (
        <ExportsGridSkeleton count={PAGE_SIZE} />
      ) : items.length === 0 ? (
        <ExportsEmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <ExportCard key={item.id} item={item} onDelete={setPendingDeleteId} />
          ))}
        </div>
      )}

      {!isLoading && (
        <ProjectsPagination
          page={page}
          totalPages={totalPages}
          onPageChange={goToPage}
        />
      )}

      <DeleteExportDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setPendingDeleteId(null);
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
