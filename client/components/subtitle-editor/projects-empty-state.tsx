"use client";

import { Plus, Subtitles } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

interface ProjectsEmptyStateProps {
  onNewProject: () => void;
}

export function ProjectsEmptyState({ onNewProject }: ProjectsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-20 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
        <Subtitles className="size-7 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">No subtitle projects yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your first project to upload a video and generate subtitles.
        </p>
      </div>
      <Button onClick={onNewProject}>
        <Plus className="size-4" />
        New Project
      </Button>
    </div>
  );
}
