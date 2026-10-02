"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSubtitleApi } from "@/hooks/subtitle/use-subtitle-api";
import { subtitleQueryKeys } from "@/hooks/subtitle/use-subtitle-queries";
import { failureMessage } from "@/components/subtitle-editor/format";

/**
 * Creates a project for an uploaded video and opens it. `isCreating` stays
 * true until the navigation replaces the current page.
 */
export function useCreateProject({
  replace = false,
}: { replace?: boolean } = {}) {
  const api = useSubtitleApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const createProject = useCallback(
    async (videoUrl: string, file: File) => {
      setIsCreating(true);
      const result = await api.createTranscription({
        videoUrl,
        filename: file.name,
      });
      if (!result.success || !result.data?.id) {
        setIsCreating(false);
        toast.error(failureMessage("create the project", result.error));
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: subtitleQueryKeys.projects(),
      });
      const href = `/subtitle-editor/${result.data.id}`;
      if (replace) router.replace(href);
      else router.push(href);
    },
    [api, queryClient, replace, router],
  );

  return { createProject, isCreating };
}
