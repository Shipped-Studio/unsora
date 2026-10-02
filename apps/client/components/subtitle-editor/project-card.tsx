"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { DotsThreeVertical, FileVideo, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoThumbnail } from "@/components/ui/video-thumbnail";
import { ProjectStatusBadge } from "@/components/subtitle-editor/project-status-badge";
import { formatClock } from "@/components/subtitle-editor/format";
import type { TranscriptionListItem } from "@/hooks/subtitle/use-subtitle-api";

export const PROJECT_GRID_CLASS =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

function projectTitle(project: TranscriptionListItem): string {
  return project.title || project.filename || "Untitled project";
}

export function ProjectCard({
  project,
  onDelete,
}: {
  project: TranscriptionListItem;
  onDelete: (project: TranscriptionListItem) => void;
}) {
  const title = projectTitle(project);
  const edited = formatDistanceToNow(new Date(project.updatedAt), {
    addSuffix: true,
  });

  return (
    <div className="relative">
      <Link
        href={`/subtitle-editor/${project.id}`}
        className="group block overflow-hidden rounded-xl bg-muted outline-none transition-colors hover:border-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="relative aspect-video overflow-hidden bg-muted">
          {project.videoUrl ? (
            <VideoThumbnail videoUrl={project.videoUrl} alt="" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <FileVideo className="size-8" />
            </div>
          )}
          {project.duration ? (
            <span className="absolute right-2 bottom-2 rounded-md bg-background/90 px-1.5 py-0.5 text-xs text-foreground tabular-nums">
              {formatClock(project.duration)}
            </span>
          ) : null}
        </div>
        <div className="space-y-1.5 p-4 pr-12">
          <p className="truncate text-sm font-medium">{title}</p>
          <div className="flex min-w-0 items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            <p className="truncate text-xs text-muted-foreground">
              Edited {edited}
            </p>
          </div>
        </div>
      </Link>

      <div className="absolute right-2 bottom-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${title}`}
              />
            }
          >
            <DotsThreeVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(project)}
            >
              <Trash />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl bg-muted">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
