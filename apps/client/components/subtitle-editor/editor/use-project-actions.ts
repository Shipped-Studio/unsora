import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { projectDisplayTitle } from "@/components/subtitle-editor/editor/read-settings";
import type { EditorSettings } from "@/components/subtitle-editor/editor/use-editor-settings";
import { failureMessage } from "@/components/subtitle-editor/format";
import { useSubtitleApi } from "@/hooks/subtitle/use-subtitle-api";
import { subtitleQueryKeys } from "@/hooks/subtitle/use-subtitle-queries";
import type { SubtitleChunk, TranscriptionData } from "@/remotion/types";

/** The project's title, saving, and the AI text it can write (title, hook). */
export function useProjectActions({
  project,
  chunks,
  settings,
  isTranscribing,
}: {
  project: TranscriptionData;
  chunks: SubtitleChunk[];
  settings: EditorSettings;
  isTranscribing: boolean;
}) {
  const api = useSubtitleApi();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(() => projectDisplayTitle(project));
  const [isSaving, setIsSaving] = useState(false);
  const [isTitling, setIsTitling] = useState(false);

  /** The projects list shows the title, so it's refetched after changes. */
  const refreshProjectList = () =>
    void queryClient.invalidateQueries({ queryKey: subtitleQueryKeys.projects() });

  /** Saves the project; `quiet` skips the toast. Resolves true when saved. */
  const save = async (quiet = false) => {
    setIsSaving(true);
    const result = await api.updateTranscription(project.id, {
      title,
      editorSettings: settings.toSaved(),
      // Don't overwrite the transcript the server is about to write.
      ...(isTranscribing ? {} : { subtitleChunks: chunks }),
    });
    setIsSaving(false);
    if (!result.success) {
      toast.error(failureMessage("save your changes", result.error));
      return false;
    }
    if (!quiet) toast.success("Changes saved");
    refreshProjectList();
    return true;
  };

  /** Resolves true when renamed. */
  const rename = async (next: string) => {
    const result = await api.updateTranscription(project.id, { title: next });
    if (!result.success) {
      toast.error(failureMessage("rename the project", result.error));
      return false;
    }
    setTitle(next);
    toast.success("Project renamed");
    refreshProjectList();
    return true;
  };

  /** Lets AI name the project from its transcript. */
  const writeTitle = async () => {
    setIsTitling(true);
    const result = await api.writeProjectTitle(project.id);
    setIsTitling(false);
    if (!result.success || !result.data) {
      toast.error(failureMessage("write a title", result.error));
      return;
    }
    setTitle(result.data.title);
    toast.success("Project renamed");
    refreshProjectList();
  };

  /** An AI hook title, different from `previousHooks`; null on failure. */
  const generateHook = async (previousHooks: string[]) => {
    const result = await api.generateHookTitle(project.id, previousHooks);
    if (!result.success || !result.data) {
      toast.error(failureMessage("write a hook", result.error));
      return null;
    }
    return result.data.hook;
  };

  return { title, isSaving, isTitling, save, rename, writeTitle, generateHook };
}

export type ProjectActions = ReturnType<typeof useProjectActions>;
