"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { DotsThree, FileVideo, Trash } from "@phosphor-icons/react";
import {
  MEDIA_ICON_BUTTON_CLASS,
  TILE_CLASS,
  TILE_SKELETON_BAR_CLASS,
  TILE_SKELETON_CLASS,
} from "@/components/generator/result-tile";
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
import { cn } from "@/lib/utils";

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
    <div className="group relative">
      <Link
        href={`/subtitle-editor/${project.id}`}
        className={cn(
          "block outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
          TILE_CLASS,
        )}
      >
        <div className="relative aspect-video overflow-hidden bg-card">
          {project.videoUrl ? (
            <VideoThumbnail
              videoUrl={project.videoUrl}
              alt=""
              className="bg-card"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <FileVideo className="size-8" />
            </div>
          )}
          {project.duration ? (
            <span className="absolute right-2 bottom-2 rounded-md bg-scrim/50 px-1.5 py-0.5 text-xs text-media-foreground tabular-nums backdrop-blur-sm">
              {formatClock(project.duration)}
            </span>
          ) : null}
        </div>
        <div className="space-y-1.5 p-3">
          <p className="truncate text-sm font-medium">{title}</p>
          <div className="flex min-w-0 items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            <p className="truncate text-xs text-muted-foreground">
              Edited {edited}
            </p>
          </div>
        </div>
      </Link>

      <div className="absolute top-2 right-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className={MEDIA_ICON_BUTTON_CLASS}
                aria-label={`Actions for ${title}`}
              />
            }
          >
            <DotsThree weight="bold" />
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
    <div className={TILE_SKELETON_CLASS}>
      <Skeleton
        className={cn("aspect-video w-full rounded-none", TILE_SKELETON_BAR_CLASS)}
      />
      <div className="space-y-2 p-3">
        <Skeleton className={cn("h-4 w-3/4", TILE_SKELETON_BAR_CLASS)} />
        <Skeleton className={cn("h-3 w-1/3", TILE_SKELETON_BAR_CLASS)} />
      </div>
    </div>
  );
}
