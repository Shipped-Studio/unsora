"use client";

import { useState } from "react";
import { ArrowsClockwise, FilmSlate } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { AIClippingClip, AIClippingJob } from "@/hooks/use-ai-clippings";
import { AIClippingJobGroup } from "./ai-clipping-job-group";
import { AIClippingClipDialog } from "./ai-clipping-clip-dialog";

interface AIClippingResultsProps {
  jobs: AIClippingJob[];
  loading: boolean;
  onRefresh: () => void;
  onDeleteJob: (jobId: string) => Promise<boolean>;
  onDeleteClip: (jobId: string, clipId: string) => Promise<boolean>;
}

export function AIClippingResults({
  jobs,
  loading,
  onRefresh,
  onDeleteJob,
  onDeleteClip,
}: AIClippingResultsProps) {
  const [selected, setSelected] = useState<{
    clip: AIClippingClip;
    job: AIClippingJob;
  } | null>(null);

  const isEmpty = jobs.length === 0;

  async function handleDeleteJob(jobId: string) {
    const ok = await onDeleteJob(jobId);
    if (ok && selected?.job.id === jobId) {
      setSelected(null);
    }
  }

  async function handleDeleteClip(jobId: string, clipId: string) {
    const ok = await onDeleteClip(jobId, clipId);
    if (ok && selected?.clip.id === clipId) {
      setSelected(null);
    }
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-auto p-3 pb-44 sm:p-5">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="space-y-3 rounded-2xl border p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-14 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <Skeleton key={j} className="aspect-video rounded-xl" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                <FilmSlate className="size-7 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  No clipping jobs yet
                </p>
                <p className="mt-1 max-w-[280px] text-xs text-muted-foreground/70">
                  Paste a video link below. Each job appears grouped with its
                  clips — click any clip to play it.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <AIClippingJobGroup
                  key={job.id}
                  job={job}
                  onPlayClip={(clip, jobItem) =>
                    setSelected({ clip, job: jobItem })
                  }
                  onDeleteJob={handleDeleteJob}
                  onDeleteClip={handleDeleteClip}
                />
              ))}
            </div>
          )}

          {loading && jobs.length > 0 && (
            <div className="flex justify-center py-4">
              <Spinner className="size-5 text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      <AIClippingClipDialog
        clip={selected?.clip ?? null}
        job={selected?.job ?? null}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}
