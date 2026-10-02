"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileVideo, UploadSimple, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { uploadFileToStorage } from "@/lib/storage-client";
import { failureMessage } from "@/components/subtitle-editor/format";
import { cn } from "@/lib/utils";

const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime";

interface Upload {
  file: File;
  previewUrl: string;
  progress: number;
}

/**
 * Drop zone that uploads one video to storage, then hands its URL to
 * `onVideoUploaded`. Removing the file or unmounting ignores the result.
 */
export function UploadArea({
  onVideoUploaded,
  className,
}: {
  onVideoUploaded: (url: string, file: File) => void;
  className?: string;
}) {
  const [upload, setUpload] = useState<Upload | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Identifies the upload whose result we still want.
  const activeRef = useRef<File | null>(null);

  const previewUrl = upload?.previewUrl;
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    const active = activeRef;
    return () => {
      active.current = null;
    };
  }, []);

  const start = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("video/")) {
        toast.error("Couldn't use that file. Choose an MP4, WebM or MOV video.");
        return;
      }
      activeRef.current = file;
      setUpload({ file, previewUrl: URL.createObjectURL(file), progress: 0 });

      const result = await uploadFileToStorage(file, ({ percentage }) => {
        if (activeRef.current !== file) return;
        setUpload((prev) => prev && { ...prev, progress: percentage });
      });
      if (activeRef.current !== file) return;
      activeRef.current = null;

      if (!result.success || !result.blobUrl) {
        toast.error(failureMessage("upload the video", result.error));
        setUpload(null);
        return;
      }
      setUpload((prev) => prev && { ...prev, progress: 100 });
      onVideoUploaded(result.blobUrl, file);
    },
    [onVideoUploaded],
  );

  const clear = () => {
    activeRef.current = null;
    setUpload(null);
  };

  if (upload) {
    return (
      <div className={cn("space-y-3 rounded-lg bg-muted p-3", className)}>
        <div className="relative overflow-hidden rounded-md bg-muted">
          <video
            src={upload.previewUrl}
            className="aspect-video w-full object-contain"
            muted
            playsInline
            autoPlay
            loop
          />
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label="Remove video"
            onClick={clear}
            className="absolute top-2 right-2"
          >
            <X />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <FileVideo className="size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 truncate text-sm">{upload.file.name}</p>
          <span className="text-xs tabular-nums text-muted-foreground">
            {upload.progress < 100 ? `${upload.progress}%` : "Uploaded"}
          </span>
        </div>
        <Progress value={upload.progress} aria-label="Upload progress" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
        isDragging && "border-foreground/40 bg-muted",
        className,
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) void start(file);
      }}
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
        <FileVideo className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Drop a video here</p>
        <p className="text-xs text-muted-foreground">MP4, WebM or MOV</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
      >
        <UploadSimple />
        Choose file
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={VIDEO_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void start(file);
        }}
      />
    </div>
  );
}
