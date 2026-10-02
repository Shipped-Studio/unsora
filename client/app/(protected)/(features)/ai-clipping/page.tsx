"use client";

import { AIClippingForm } from "@/components/ai-clipping/ai-clipping-form";
import { AIClippingResults } from "@/components/ai-clipping/ai-clipping-results";
import {
  useAiClippings,
  type AIClippingJob,
} from "@/hooks/use-ai-clippings";

export default function AIClippingPage() {
  const { jobs, loading, refresh, prependJob, deleteJob, deleteClip } =
    useAiClippings();

  function handleJobCreated(job: AIClippingJob) {
    prependJob(job);
  }

  return (
    <div className="flex flex-1 flex-col lg:max-h-[calc(100vh-64px)]">
      <AIClippingResults
        jobs={jobs}
        loading={loading}
        onRefresh={refresh}
        onDeleteJob={deleteJob}
        onDeleteClip={deleteClip}
      />
      <AIClippingForm onJobCreated={handleJobCreated} />
    </div>
  );
}
