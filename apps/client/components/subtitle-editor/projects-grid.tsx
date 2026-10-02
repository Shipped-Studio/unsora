"use client";

import {
  PROJECT_GRID_CLASS,
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
    <div className={PROJECT_GRID_CLASS}>
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} onDelete={onDelete} />
      ))}
    </div>
  );
}

export function ProjectsGridSkeleton({ count }: { count: number }) {
  return (
    <div className={PROJECT_GRID_CLASS} aria-busy>
      {Array.from({ length: count }, (_, i) => (
        <ProjectCardSkeleton key={i} />
      ))}
    </div>
  );
}
