"use client";

import { useParams } from "next/navigation";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { ErrorState, LoadingState } from "@/components/shared/states";
import {
  EDITOR_PARENTS,
  SubtitleEditor,
  SubtitleEditorSkeleton,
} from "@/components/subtitle-editor/subtitle-editor";
import { UploadArea } from "@/components/subtitle-editor/upload-area";
import { useCreateProject } from "@/hooks/subtitle/use-create-project";
import { useTranscriptionData } from "@/hooks/subtitle/use-transcription-data";

export default function SubtitleProjectPage() {
  const { id } = useParams<{ id: string }>();
  // A new id is a new project: start from fresh state.
  return <SubtitleProject key={id} id={id} />;
}

function SubtitleProject({ id }: { id: string }) {
  const data = useTranscriptionData(id);
  const { createProject, isCreating } = useCreateProject({ replace: true });

  if (isCreating) {
    return (
      <>
        <PageHeader parents={EDITOR_PARENTS} title="New project" />
        <PageBody width="narrow">
          <LoadingState label="Creating project" />
        </PageBody>
      </>
    );
  }

  if (data.phase === "loading") {
    return (
      <>
        <PageHeader
          parents={EDITOR_PARENTS}
          title={
            <span className="inline-block h-4 w-40 animate-pulse rounded-md bg-muted align-middle">
              <span className="sr-only">Loading project</span>
            </span>
          }
        />
        <SubtitleEditorSkeleton />
      </>
    );
  }

  // Links like the home page's open an id that doesn't exist yet: start a
  // new project there.
  if (data.phase === "not-found") {
    return (
      <>
        <PageHeader parents={EDITOR_PARENTS} title="New project" />
        <PageBody width="narrow" className="space-y-4">
          <div>
            <h2 className="text-sm font-medium">Upload a video</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              You can transcribe and style its subtitles once it&apos;s
              uploaded.
            </p>
          </div>
          <UploadArea onVideoUploaded={createProject} />
        </PageBody>
      </>
    );
  }

  if (data.phase === "error" || !data.project) {
    return (
      <>
        <PageHeader parents={EDITOR_PARENTS} title="Project" />
        <PageBody>
          <ErrorState
            title="Couldn't load this project"
            description={data.loadError ?? undefined}
            onRetry={data.retry}
          />
        </PageBody>
      </>
    );
  }

  return (
    <SubtitleEditor
      project={data.project}
      status={data.status}
      transcriptionError={data.transcriptionError}
      isStarting={data.isStarting}
      onStartTranscription={data.startTranscription}
      onChunksChange={data.setChunks}
      onMaxWordsChange={data.setMaxWords}
      onRefreshExports={data.refreshExports}
    />
  );
}
