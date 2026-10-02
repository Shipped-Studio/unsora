"use client";

import { calculateSubtitleRemovalCredits } from "@/lib/video-utils";
import type { VideoFile } from "@/types/video";
import { VideoJobForm } from "./video-job-form";

const MAX_FILES = 10;

export interface SubtitleRemovalInput {
  videoUrl: string;
  originalName: string;
  method: string;
  durationSeconds: number;
}

export function SubtitleRemoverForm({
  onSubmit,
}: {
  onSubmit: (videos: SubtitleRemovalInput[]) => Promise<boolean>;
}) {
  return (
    <VideoJobForm
      action="subtitle-removal"
      maxFiles={MAX_FILES}
      hint="MP4, WebM or MOV, up to 2 minutes each"
      submitLabel="Remove subtitles"
      credits={(videos) =>
        videos.reduce(
          (sum, video) =>
            sum + calculateSubtitleRemovalCredits(video.duration ?? 0),
          0,
        )
      }
      onSubmit={(videos: VideoFile[]) =>
        onSubmit(
          videos
            .filter((video) => video.storageBlobUrl || video.url)
            .map((video) => ({
              videoUrl: (video.storageBlobUrl || video.url)!,
              originalName: video.name,
              method: video.url ? "url" : "upload",
              durationSeconds: video.duration ?? 0,
            })),
        )
      }
    />
  );
}
