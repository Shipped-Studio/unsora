"use client";

import {
  ProjectCard,
  ProjectCardSkeleton,
  type TranscriptionListItem,
} from "@/components/subtitle-editor/project-card";

const GRID_CLASS =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

interface ProjectsGridProps {
  projects: TranscriptionListItem[];
  onDelete: (id: string) => void;
}

export function ProjectsGrid({ projects, onDelete }: ProjectsGridProps) {
  return (
    <div className={GRID_CLASS}>
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

interface ProjectsGridSkeletonProps {
  count?: number;
}

export function ProjectsGridSkeleton({ count = 12 }: ProjectsGridSkeletonProps) {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: count }).map((_, i) => (
        <ProjectCardSkeleton key={i} />
      ))}
    </div>
  );
}
