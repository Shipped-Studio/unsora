"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { DownloadSimple, Plus, Subtitles } from "@phosphor-icons/react";
import { ToolPage } from "@/components/generator/tool-layout";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { ToolArt } from "@/components/graphics/tool-art";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DeleteDialog } from "@/components/subtitle-editor/delete-dialog";
import { failureMessage } from "@/components/subtitle-editor/format";
import {
  ListPagination,
  usePageParam,
} from "@/components/subtitle-editor/list-pagination";
import {
  ProjectsGrid,
  ProjectsGridSkeleton,
} from "@/components/subtitle-editor/projects-grid";
import { UploadDialog } from "@/components/subtitle-editor/upload-dialog";
import { useCreateProject } from "@/hooks/subtitle/use-create-project";
import type { TranscriptionListItem } from "@/hooks/subtitle/use-subtitle-api";
import {
  SUBTITLE_PAGE_SIZE,
  useDeleteSubtitleProject,
  useSubtitleProjects,
} from "@/hooks/subtitle/use-subtitle-queries";

export default function SubtitleProjectsPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const { createProject, isCreating } = useCreateProject();
  const openUpload = () => setUploadOpen(true);

  return (
    <ToolPage
      actions={
        <>
          {/* Icon-only below sm so the page title keeps its room. */}
          <Link
            href="/subtitle-editor/exports"
            className={cn(buttonVariants({ variant: "outline" }), ICON_ONLY_MOBILE)}
          >
            <DownloadSimple />
            <span className="max-sm:sr-only">Exports</span>
          </Link>
          <Button onClick={openUpload} className={ICON_ONLY_MOBILE}>
            <Plus />
            <span className="max-sm:sr-only">New project</span>
          </Button>
        </>
      }
    >
      <Suspense fallback={<ProjectsGridSkeleton count={SUBTITLE_PAGE_SIZE} />}>
        <ProjectsList onNewProject={openUpload} />
      </Suspense>
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onVideoUploaded={createProject}
        isCreating={isCreating}
      />
    </ToolPage>
  );
}

/** Square icon button below sm; the label stays for screen readers. */
const ICON_ONLY_MOBILE = "max-sm:w-9 max-sm:px-0";

function ProjectsList({ onNewProject }: { onNewProject: () => void }) {
  const page = usePageParam();
  const { data, isPending, isError, error, refetch, isPlaceholderData } =
    useSubtitleProjects(page);
  const deleteProject = useDeleteSubtitleProject();
  const [pendingDelete, setPendingDelete] =
    useState<TranscriptionListItem | null>(null);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteProject.mutate(pendingDelete.id, {
      onSuccess: () => {
        setPendingDelete(null);
        toast.success("Project deleted");
      },
      onError: (err) => toast.error(failureMessage("delete the project", err)),
    });
  };

  if (isPending) {
    return <ProjectsGridSkeleton count={SUBTITLE_PAGE_SIZE} />;
  }

  if (isError && !data) {
    return (
      <ErrorState
        title="Couldn't load your projects"
        description={error.message}
        onRetry={() => void refetch()}
      />
    );
  }

  const items = data?.items ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;

  if (items.length === 0) {
    // Centred in the room left under the header, like ToolEmpty.
    return (
      <div className="flex flex-1 flex-col justify-center">
        {page > 1 ? (
          <EmptyState
            icon={Subtitles}
            title="Nothing on this page"
            description="This page is past the end of your projects."
            action={{ label: "Go to first page", href: "/subtitle-editor" }}
          />
        ) : (
          <EmptyState
            icon={Subtitles}
            art={<ToolArt href="/subtitle-editor" />}
            title="No subtitle projects yet"
            description="Upload a video to transcribe it and style its subtitles."
            action={{ label: "New project", onClick: onNewProject }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        aria-busy={isPlaceholderData}
        className={isPlaceholderData ? "opacity-70 transition-opacity" : undefined}
      >
        <ProjectsGrid projects={items} onDelete={setPendingDelete} />
      </div>
      <ListPagination page={page} totalPages={totalPages} />
      <DeleteDialog
        open={pendingDelete !== null}
        title="Delete this project?"
        description="The project and all of its exports are deleted for good."
        isDeleting={deleteProject.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
