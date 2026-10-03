"use client";

import { ToolGrid } from "@/components/generator/tool-layout";
import {
  ProjectCard,
  ProjectCardSkeleton,
} from "@/components/subtitle-editor/project-card";
import type { TranscriptionListItem } from "@/hooks/subtitle/use-subtitle-api";

export function ProjectsGrid({
  projects,
  onDelete,
}: {
  projects: TranscriptionListItem[];
  onDelete: (project: TranscriptionListItem) => void;
}) {
  return (
    <ToolGrid shape="video">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} onDelete={onDelete} />
      ))}
    </ToolGrid>
  );
}

export function ProjectsGridSkeleton({ count }: { count: number }) {
  return (
    <div aria-busy>
      <ToolGrid shape="video">
        {Array.from({ length: count }, (_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </ToolGrid>
    </div>
  );
}
