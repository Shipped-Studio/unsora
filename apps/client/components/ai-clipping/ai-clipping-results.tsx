"use client";

import { useMemo, useState } from "react";
import { Scissors } from "@phosphor-icons/react";
import { ToolEmpty } from "@/components/generator/tool-layout";
import { ErrorState } from "@/components/shared/states";
import type { AIClippingJob } from "@/hooks/use-ai-clippings";
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
  // Ids, not objects: the open clip follows polling, so it switches from
  // thumbnail to video as soon as the clip finishes rendering.
  const [selectedIds, setSelectedIds] = useState<{
    jobId: string;
    clipId: string;
  } | null>(null);
  const selected = useMemo(() => {
    if (!selectedIds) return null;
    const job = jobs.find((j) => j.id === selectedIds.jobId);
    const clip = job?.clips.find((c) => c.id === selectedIds.clipId);
    return job && clip ? { job, clip } : null;
  }, [jobs, selectedIds]);

  async function handleDeleteJob(jobId: string) {
    const deleted = await onDeleteJob(jobId);
    if (deleted && selectedIds?.jobId === jobId) setSelectedIds(null);
  }

  async function handleDeleteClip(jobId: string, clipId: string) {
    const deleted = await onDeleteClip(jobId, clipId);
    if (deleted && selectedIds?.clipId === clipId) setSelectedIds(null);
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
            onOpenClip={(clip, jobItem) =>
              setSelectedIds({ jobId: jobItem.id, clipId: clip.id })
            }
            onDeleteJob={(jobId) => void handleDeleteJob(jobId)}
            onDeleteClip={(jobId, clipId) => void handleDeleteClip(jobId, clipId)}
          />
        ))}
      </div>

      <AIClippingClipDialog
        selected={selected}
        onOpenChange={(open) => {
          if (!open) setSelectedIds(null);
        }}
      />
    </>
  );
}
