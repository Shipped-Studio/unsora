"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { DotsThreeVertical, FileVideo, Trash } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoThumbnail } from "@/components/ui/video-thumbnail";

export interface TranscriptionListItem {
  id: string;
  videoUrl?: string | null;
  filename?: string | null;
  text?: string | null;
  language?: string | null;
  duration?: number | null;
  status: "draft" | "pending" | "processing" | "completed" | "failed" | string;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProjectCardProps {
  project: TranscriptionListItem;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const title = project.filename || "Untitled Project";
  const updated = project.updatedAt
    ? formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })
    : "";

  return (
    <Card
      size="sm"
      className="group relative gap-0 rounded-xl py-0 transition-all hover:shadow-md"
    >
      <Link href={`/subtitle-editor/${project.id}`} className="block">
        <div className="relative aspect-video w-full overflow-hidden bg-card">
          {project.videoUrl ? (
            <VideoThumbnail videoUrl={project.videoUrl} alt={title} />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FileVideo className="size-10 text-muted-foreground" />
            </div>
          )}
        </div>
        <CardContent className="space-y-1 p-3 pr-10">
          <p className="truncate font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{updated}</p>
        </CardContent>
      </Link>

      <div className="absolute bottom-2 right-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 data-popup-open:opacity-100">
            <DotsThreeVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => onDelete(project.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

export function ProjectCardSkeleton() {
  return (
    <Card size="sm" className="gap-0 rounded-xl py-0">
      <Skeleton className="aspect-video w-full rounded-t-xl rounded-b-none" />
      <CardContent className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </CardContent>
    </Card>
  );
}
