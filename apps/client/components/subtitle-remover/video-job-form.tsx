"use client";

import { useRef, useState } from "react";
import { FileVideo, UploadSimple, WarningCircle, X } from "@phosphor-icons/react";
import { MEDIA_ICON_BUTTON_CLASS } from "@/components/generator/result-tile";
import {
  ToolSidebarBody,
  ToolSidebarFooter,
} from "@/components/generator/tool-layout";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/ui/generate-button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useVideoManager } from "@/hooks/use-video-manager";
import type { VideoAction } from "@/lib/video-utils";
import type { VideoFile } from "@/types/video";

const ACCEPTED_TYPES = ".mp4,.webm,.mov";

interface VideoJobFormProps {
  /** Validation rules to apply to each file (duration, size). */
  action: VideoAction;
  maxFiles: number;
  /** Short format and length note under the drop zone. */
  hint: string;
  submitLabel: string;
  credits: (videos: VideoFile[]) => number;
  /** Tool-specific options rendered under the file list. */
  settings?: React.ReactNode;
  /** Resolves true when the jobs were created; the queue is then cleared. */
  onSubmit: (videos: VideoFile[]) => Promise<boolean>;
}

/**
 * Side-panel form shared by the upload-based video tools: a drop zone, the
 * queued files with upload progress, optional settings and the submit button.
 */
export function VideoJobForm({
  action,
  maxFiles,
  hint,
  submitLabel,
  credits,
  settings,
  onSubmit,
}: VideoJobFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { videos, handleFiles, removeVideo, clearAll } = useVideoManager(
    maxFiles,
    action,
  );

  const ready = videos.filter((v) => v.uploadStatus === "completed");
  const uploading = videos.some(
    (v) => v.uploadStatus === "uploading" || v.uploadStatus === "pending",
  );
  const canSubmit =
    ready.length > 0 && ready.length === videos.length && !submitting;
  const estimate = videos.length > 0 ? credits(videos) : 0;
  const totalCredits = estimate > 0 ? estimate : undefined;
  const isFull = videos.length >= maxFiles;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const ok = await onSubmit(ready);
      if (ok) clearAll();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ToolSidebarBody>
        <section className="space-y-3">
          <div className="flex h-6 items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Videos</h2>
            {videos.length > 0 ? (
              <Button variant="ghost" size="xs" onClick={clearAll}>
                Clear all
              </Button>
            ) : null}
          </div>

          <button
            type="button"
            disabled={isFull || submitting}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (event.dataTransfer.files.length > 0) {
                void handleFiles(event.dataTransfer.files);
              }
            }}
            data-dragging={dragging || undefined}
            className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-dragging:border-ring data-dragging:bg-muted"
          >
            <UploadSimple className="mb-1 size-5 text-muted-foreground" />
            <span className="text-sm font-medium">
              Drop videos or click to browse
            </span>
            <span className="text-xs text-muted-foreground">{hint}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {videos.length} of {maxFiles} added
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void handleFiles(event.target.files);
              event.target.value = "";
            }}
          />

          {videos.length > 0 ? (
            <ul className="grid grid-cols-4 gap-2">
              {videos.map((video) => (
                <QueuedVideo
                  key={video.id}
                  video={video}
                  onRemove={() => removeVideo(video.id)}
                />
              ))}
            </ul>
          ) : null}
        </section>

        {settings}
      </ToolSidebarBody>

      <ToolSidebarFooter>
        <GenerateButton
          label={submitLabel}
          credits={totalCredits}
          disabled={!canSubmit}
          submitting={submitting}
          submitState={uploading ? "uploading" : undefined}
          onClick={handleSubmit}
          className="w-full"
        />
      </ToolSidebarFooter>
    </>
  );
}

function QueuedVideo({
  video,
  onRemove,
}: {
  video: VideoFile;
  onRemove: () => void;
}) {
  const failed = video.uploadStatus === "failed";
  const busy =
    video.uploadStatus === "uploading" || video.uploadStatus === "pending";

  return (
    <li
      className="relative aspect-square overflow-hidden rounded-lg bg-muted"
      title={failed ? video.uploadError : video.name}
    >
      {video.previewUrl ? (
        <video
          src={video.previewUrl}
          className="size-full object-cover"
          muted
          playsInline
          preload="metadata"
          aria-label={video.name}
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <FileVideo className="size-4 text-muted-foreground" />
        </div>
      )}

      {busy ? (
        <div className="absolute inset-0 flex items-center justify-center bg-scrim/50 text-2xs font-medium text-media-foreground tabular-nums">
          {video.uploadStatus === "uploading" ? (
            `${video.uploadProgress}%`
          ) : (
            <Spinner className="size-3.5" />
          )}
        </div>
      ) : null}

      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80">
          <WarningCircle className="size-5 text-destructive" />
          <span className="sr-only">Upload failed</span>
        </div>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={cn("absolute top-1 right-1", MEDIA_ICON_BUTTON_CLASS)}
        aria-label={`Remove ${video.name}`}
        onClick={onRemove}
      >
        <X />
      </Button>
    </li>
  );
}
