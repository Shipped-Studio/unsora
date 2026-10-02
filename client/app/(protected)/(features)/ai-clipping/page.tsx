"use client";

import { AIClippingForm } from "@/components/ai-clipping/ai-clipping-form";
import { AIClippingResults } from "@/components/ai-clipping/ai-clipping-results";
import { ToolPage } from "@/components/generator/tool-layout";
import { useAiClippings } from "@/hooks/use-ai-clippings";

export default function AIClippingPage() {
  const { jobs, isLoading, error, refetch, prependJob, deleteJob, deleteClip } =
    useAiClippings();

  return (
    <ToolPage dock={<AIClippingForm onJobCreated={prependJob} />}>
      <AIClippingResults
        jobs={jobs}
        isLoading={isLoading}
        error={error}
        onRetry={() => void refetch()}
        onDeleteJob={deleteJob}
        onDeleteClip={deleteClip}
      />
    </ToolPage>
  );
}
