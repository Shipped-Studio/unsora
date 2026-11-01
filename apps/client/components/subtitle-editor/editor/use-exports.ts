import { useState } from "react";
import { toast } from "sonner";
import { timelineDuration } from "@/components/subtitle-editor/caption-style";
import type { EditorSettings } from "@/components/subtitle-editor/editor/use-editor-settings";
import { failureMessage } from "@/components/subtitle-editor/format";
import { useExportJob } from "@/hooks/subtitle/use-export-job";
import { useDeleteSubtitleExport } from "@/hooks/subtitle/use-subtitle-queries";
import type { SubtitleChunk, TranscriptionData, VideoExportItem } from "@/remotion/types";

/** Rendering the project to a video file, and deleting past exports. */
export function useExports({
  project,
  chunks,
  settings,
  onRefreshExports,
}: {
  project: TranscriptionData;
  chunks: SubtitleChunk[];
  settings: EditorSettings;
  onRefreshExports: () => Promise<void>;
}) {
  const job = useExportJob({ onSettled: () => void onRefreshExports() });
  const deleteExport = useDeleteSubtitleExport();
  /** The progress dialog, open while an export runs. */
  const [progressOpen, setProgressOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  /** The export waiting for the user to confirm its deletion. */
  const [pendingDelete, setPendingDelete] = useState<VideoExportItem | null>(null);

  const videoUrl = project.videoAsset?.url ?? null;

  const start = async (name: string) => {
    if (!videoUrl) return;
    setFileName(name);
    setProgressOpen(true);
    const queued = await job.startExport({
      transcriptionId: project.id,
      videoUrl,
      subtitleChunks: chunks,
      style: { fileName: name, ...settings.toSaved() },
      duration: timelineDuration(settings.timeline, project.duration ?? 0),
      width: settings.frame.width,
      height: settings.frame.height,
    });
    if (queued) void onRefreshExports();
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteExport.mutate(pendingDelete.id, {
      onSuccess: () => {
        setPendingDelete(null);
        toast.success("Export deleted");
        void onRefreshExports();
      },
      onError: (error) => toast.error(failureMessage("delete the export", error)),
    });
  };

  return {
    job,
    start,
    progressOpen,
    setProgressOpen,
    fileName,
    pendingDelete,
    setPendingDelete,
    confirmDelete,
    isDeleting: deleteExport.isPending,
  };
}
