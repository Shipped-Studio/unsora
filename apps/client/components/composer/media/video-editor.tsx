"use client";

import { useRef, useState } from "react";
import { ArrowsClockwise, ImageSquare, Trash, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { CoverDialog } from "./cover-dialog";
import { MediaDrop } from "./media-drop";
import type { Composer } from "@/hooks/use-composer";
import { formatDuration } from "@/lib/scheduler/dates";

function formatBytes(bytes?: number) {
  if (!bytes) return null;
  if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;
}

export function VideoEditor({
  composer,
  onOpenLibrary,
  showCover,
}: {
  composer: Composer;
  onOpenLibrary: () => void;
  /** Only when a selected platform uses a cover. */
  showCover: boolean;
}) {
  const { state, uploadFiles, removeMedia, setCover } = composer;
  const video = state.media.find((m) => m.kind === "video");
  const [coverOpen, setCoverOpen] = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);

  if (!video) {
    return (
      <MediaDrop
        kind="video"
        title="Add a video"
        hint="MP4 or MOV. Vertical 9:16 works everywhere; YouTube also takes 16:9."
        onFiles={(files) => void uploadFiles(files, "video", { replace: true })}
        onOpenLibrary={onOpenLibrary}
      />
    );
  }

  const meta = [
    video.duration ? formatDuration(video.duration) : null,
    video.width && video.height ? `${video.width} × ${video.height}` : null,
    formatBytes(video.size),
  ].filter(Boolean);

  return (
    <div className="overflow-hidden rounded-xl bg-muted">
      <div className="grid gap-4 p-3 sm:grid-cols-[minmax(0,220px)_1fr]">
        <div className="relative overflow-hidden rounded-md bg-media">
          <video
            key={video.previewUrl}
            src={video.previewUrl}
            controls
            playsInline
            preload="metadata"
            className="aspect-[9/16] w-full object-contain"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="space-y-1">
            <p className="truncate text-sm font-medium text-foreground">
              {video.name || "Video"}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {meta.join(" · ") || "Reading file details"}
            </p>
          </div>

          {video.status === "uploading" ? (
            <div className="space-y-1.5">
              <Progress value={video.progress} />
              <p className="text-xs text-muted-foreground tabular-nums">
                Uploading {video.progress}%
              </p>
            </div>
          ) : null}
          {video.status === "error" ? (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <WarningCircle className="size-4" />
              {video.error || "Upload failed."}
            </p>
          ) : null}

          {showCover ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Cover</p>
              <div className="flex items-center gap-3">
                <div className="flex size-16 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {state.cover ? (
                    <img src={state.cover.previewUrl} alt="Cover" className="size-full object-cover" />
                  ) : (
                    <ImageSquare className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col items-start gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={video.status !== "ready"}
                    onClick={() => setCoverOpen(true)}
                  >
                    {state.cover ? "Change cover" : "Choose cover"}
                  </Button>
                  {state.cover?.status === "uploading" ? (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Spinner className="size-3" /> Saving cover
                    </span>
                  ) : state.cover ? (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => void setCover(null)}
                    >
                      Remove cover
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Platforms pick a frame if you don&apos;t.
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-auto flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => replaceRef.current?.click()}
            >
              <ArrowsClockwise />
              Replace
            </Button>
            <input
              ref={replaceRef}
              type="file"
              accept="video/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadFiles([file], "video", { replace: true });
              }}
            />
            <Button type="button" variant="ghost" size="sm" onClick={onOpenLibrary}>
              Choose from Library
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => removeMedia(video.key)}
            >
              <Trash />
              Remove
            </Button>
          </div>
        </div>
      </div>

      {video.status === "ready" ? (
        <CoverDialog
          open={coverOpen}
          onOpenChange={setCoverOpen}
          videoUrl={video.url ?? video.previewUrl}
          duration={video.duration}
          onSave={(input) => void setCover(input)}
        />
      ) : null}
    </div>
  );
}
