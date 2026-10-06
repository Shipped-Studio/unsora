"use client";

import { useState } from "react";
import { Scissors } from "@phosphor-icons/react";
import { ToolEmpty } from "@/components/generator/tool-layout";
import { ErrorState } from "@/components/shared/states";
import type { AIClippingClip, AIClippingJob } from "@/hooks/use-ai-clippings";
import { AIClippingClipDialog } from "./ai-clipping-clip-dialog";
import { AIClippingJobGroup, JobGroupSkeleton } from "./ai-clipping-job-group";

interface AIClippingResultsProps {
  jobs: AIClippingJob[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  onDeleteJob: (jobId: string) => Promise<boolean>;
  onDeleteClip: (jobId: string, clipId: string) => Promise<boolean>;
}

/** Clipping jobs, newest first, each with its clips. */
export function AIClippingResults({
  jobs,
  isLoading,
  error,
  onRetry,
  onDeleteJob,
  onDeleteClip,
}: AIClippingResultsProps) {
  const [selected, setSelected] = useState<{
    clip: AIClippingClip;
    job: AIClippingJob;
  } | null>(null);

  async function handleDeleteJob(jobId: string) {
    const deleted = await onDeleteJob(jobId);
    if (deleted && selected?.job.id === jobId) setSelected(null);
  }

  async function handleDeleteClip(jobId: string, clipId: string) {
    const deleted = await onDeleteClip(jobId, clipId);
    if (deleted && selected?.clip.id === clipId) setSelected(null);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <JobGroupSkeleton />
        <JobGroupSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Couldn't load your clips"
        description={error.message}
        onRetry={onRetry}
      />
    );
  }

  if (jobs.length === 0) {
    return (
      <ToolEmpty
        showcase
        icon={Scissors}
        title="No clips yet"
        description="Paste a link to a long video and get short clips you can schedule."
      />
    );
  }

  return (
    <>
      <div className="space-y-4">
        {jobs.map((job, index) => (
          <AIClippingJobGroup
            key={job.id}
            job={job}
            defaultOpen={index === 0}
            onOpenClip={(clip, jobItem) => setSelected({ clip, job: jobItem })}
            onDeleteJob={(jobId) => void handleDeleteJob(jobId)}
            onDeleteClip={(jobId, clipId) => void handleDeleteClip(jobId, clipId)}
          />
        ))}
      </div>

      <AIClippingClipDialog
        selected={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}
