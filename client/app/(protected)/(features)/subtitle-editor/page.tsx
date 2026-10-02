"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Plus, DownloadSimple } from "@phosphor-icons/react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSubtitleApi } from "@/hooks/subtitle/use-subtitle-api";
import {
  ProjectsGrid,
  ProjectsGridSkeleton,
} from "@/components/subtitle-editor/projects-grid";
import { ProjectsEmptyState } from "@/components/subtitle-editor/projects-empty-state";
import {
  ProjectsPagination,
  type PaginationMeta,
} from "@/components/subtitle-editor/projects-pagination";
import { DeleteProjectDialog } from "@/components/subtitle-editor/delete-project-dialog";
import { UploadDialog } from "@/components/subtitle-editor/upload-dialog";
import type { TranscriptionListItem } from "@/components/subtitle-editor/project-card";

const PAGE_SIZE = 12;

export default function SubtitleEditorIndexPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Subtitle Editor
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                All your subtitle projects in one place.
              </p>
            </div>
          </div>
          <ProjectsGridSkeleton count={PAGE_SIZE} />
        </div>
      }
    >
      <SubtitleEditorIndex />
    </Suspense>
  );
}

function SubtitleEditorIndex() {
  const { getUserTranscriptions, deleteTranscription, createTranscription } =
    useSubtitleApi();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = useMemo(() => {
    const raw = parseInt(searchParams.get("page") ?? "1", 10);
    return Number.isFinite(raw) && raw >= 1 ? raw : 1;
  }, [searchParams]);

  const [items, setItems] = useState<TranscriptionListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleVideoUploaded = useCallback(
    async (blobUrl: string, file: File) => {
      setIsCreating(true);
      try {
        const result = await createTranscription({
          videoUrl: blobUrl,
          filename: file.name,
        });
        if (!result.success || !result.data?.id) {
          throw new Error(result.error || "Failed to create project");
        }
        router.push(`/subtitle-editor/${result.data.id}`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to create project",
        );
        setIsCreating(false);
        setUploadOpen(false);
      }
    },
    // createTranscription identity changes every render; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router],
  );

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
        const result = await getUserTranscriptions(page, PAGE_SIZE);
        if (cancelled) return;
        if (result.success && Array.isArray(result.data)) {
          setItems(result.data as TranscriptionListItem[]);
          if (result.pagination) {
            setPagination(result.pagination as PaginationMeta);
          }
        } else if (!result.success) {
          toast.error(result.error || "Failed to load projects");
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
      const result = await deleteTranscription(pendingDeleteId);
      if (result.success) {
        setItems((prev) => prev.filter((p) => p.id !== pendingDeleteId));
        setPagination((prev) =>
          prev
            ? { ...prev, totalCount: Math.max(0, prev.totalCount - 1) }
            : prev,
        );
        toast.success("Project deleted");
        setPendingDeleteId(null);
      } else {
        toast.error(result.error || "Failed to delete project");
      }
    } finally {
      setIsDeleting(false);
    }
    // deleteTranscription identity changes every render; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDeleteId]);

  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Subtitle Editor</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            All your subtitle projects in one place.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:self-start">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            render={<Link href="/subtitle-editor/exports" />}
          >
            <DownloadSimple className="size-4" />
            Exports
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={() => setUploadOpen(true)}
          >
            <Plus className="size-4" />
            New Project
          </Button>
        </div>
      </div>

      {isLoading ? (
        <ProjectsGridSkeleton count={PAGE_SIZE} />
      ) : items.length === 0 ? (
        <ProjectsEmptyState onNewProject={() => setUploadOpen(true)} />
      ) : (
        <ProjectsGrid projects={items} onDelete={setPendingDeleteId} />
      )}

      {!isLoading && (
        <ProjectsPagination
          page={page}
          totalPages={totalPages}
          onPageChange={goToPage}
        />
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={(open) => {
          if (isCreating) return;
          setUploadOpen(open);
        }}
        onVideoUploaded={handleVideoUploaded}
        isCreating={isCreating}
      />

      <DeleteProjectDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
